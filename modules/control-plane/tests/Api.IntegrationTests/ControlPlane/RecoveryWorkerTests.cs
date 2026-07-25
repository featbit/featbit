using Api.IntegrationTests.Stubs;
using System.Reflection;
using Api.Application.ControlPlane;
using Api.Infrastructure.Caches;
using Api.IntegrationTests.Fixtures;
using Application.Caches;
using Application.ControlPlane;
using Application.Services;
using Domain.ControlPlane;
using Domain.FeatureFlags;
using Domain.Messages;
using Domain.Organizations;
using Domain.Projects;
using Domain.Segments;
using Infrastructure.Caches.Redis;
using Infrastructure.Persistence.MongoDb;
using Infrastructure.Services.MongoDb;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using MongoDB.Bson;
using StackExchange.Redis;
using Action = Domain.Messages.Action;

namespace Api.IntegrationTests.ControlPlane;

/// <summary>
/// E1 returning-DC recovery acceptance tests. Exercises the locked Model A design end-to-end against
/// real infrastructure: a real MongoDB (committed flags + DC leases) and a real Redis whose two
/// logical DB indexes simulate two DCs' Redis (dc-a = db 0, dc-b = db 1).
///
/// Scenario: both DCs committed v1; dc-b loses its lease; the flag is committed to v2 on dc-a only
/// (dc-b absent); dc-b's lease returns -> a recovery tick backfills dc-b's Redis so it reaches v2
/// (versioned value key + committed pointer + index all at v2). A DC already current is a no-op.
///
/// Uses shared Testcontainers MongoDB and Redis fixtures; Redis logical DB indexes simulate DCs.
/// </summary>
[Collection(MongoRedisCollection.Name)]
public sealed class RecoveryWorkerTests : IntegrationTestBase, IAsyncLifetime
{
    private readonly MongoDbFixture _mongoFixture;
    private readonly RedisFixture _redisFixture;

    private const string DcA = "dc-a";
    private const string DcB = "dc-b";

    private readonly string _dbName = $"featbit_e1_test_{Guid.NewGuid():N}";
    private readonly Guid _envId = Guid.NewGuid();

    private MongoDbClient _mongoDb = null!;
    private FeatureFlagService _flagService = null!;
    private SegmentService _segmentService = null!;
    private EnvironmentService _environmentService = null!;
    private MongoLeaseStore _leaseStore = null!;

    private ConnectionMultiplexer _mux = null!;
    private RedisCacheService _dcaCache = null!; // db 0
    private RedisCacheService _dcbCache = null!; // db 1
    private CompositeRedisCacheService _composite = null!;

    // Spy producer the SUT publishes the per-DC client-refresh command to. Set by CreateSut.
    private RecordingMessageProducer _producer = null!;

    public RecoveryWorkerTests(MongoDbFixture mongoFixture, RedisFixture redisFixture)
    {
        _mongoFixture = mongoFixture;
        _redisFixture = redisFixture;
    }

    public async Task InitializeAsync()
    {
        if (!DockerAvailability.IsAvailable)
        {
            return;
        }

        // ---- Mongo ----
        var options = Options.Create(new MongoDbOptions
        {
            ConnectionString = _mongoFixture.ConnectionString,
            Database = _dbName
        });
        _mongoDb = new MongoDbClient(options);
        await _mongoDb.Database.RunCommandAsync<BsonDocument>(new BsonDocument("ping", 1));

        _flagService = new FeatureFlagService(_mongoDb);
        _segmentService = new SegmentService(_mongoDb, NullLogger<SegmentService>.Instance);
        _environmentService = new EnvironmentService(_mongoDb, NullLogger<EnvironmentService>.Instance);
        _leaseStore = new MongoLeaseStore(_mongoDb);

        // ---- Redis (two DB indexes = two DCs) ----
        var redisOptions = ConfigurationOptions.Parse(_redisFixture.ConnectionString);
        redisOptions.AllowAdmin = true;

        _mux = await ConnectionMultiplexer.ConnectAsync(redisOptions);
        await _mux.GetDatabase(0).ExecuteAsync("FLUSHDB");
        await _mux.GetDatabase(1).ExecuteAsync("FLUSHDB");

        _dcaCache = new RedisCacheService(new TestRedisClient(_mux, db: 0));
        _dcbCache = new RedisCacheService(new TestRedisClient(_mux, db: 1));

        _composite = new CompositeRedisCacheService(
            new[]
            {
                new DcCacheService(DcA, _dcaCache),
                new DcCacheService(DcB, _dcbCache)
            },
            NullLogger<CompositeRedisCacheService>.Instance);
    }

    public async Task DisposeAsync()
    {
        // flush both DC DB indexes so a shared Redis is left clean
        await _mux.GetDatabase(0).ExecuteAsync("FLUSHDB");
        await _mux.GetDatabase(1).ExecuteAsync("FLUSHDB");
        _mux.Dispose();

        await _mongoDb.Database.Client.DropDatabaseAsync(_dbName);
    }

    // ----- helpers -----

    private FeatureFlag CreateFlag(string key, bool isEnabled)
    {
        var enabledVariationId = Guid.NewGuid().ToString();
        var disabledVariationId = Guid.NewGuid().ToString();

        var variations = new List<Variation>
        {
            new() { Id = enabledVariationId, Name = "true", Value = "true" },
            new() { Id = disabledVariationId, Name = "false", Value = "false" }
        };

        return new FeatureFlag(
            envId: _envId,
            name: key,
            description: string.Empty,
            key: key,
            isEnabled: isEnabled,
            variationType: "boolean",
            variations: variations,
            disabledVariationId: disabledVariationId,
            enabledVariationId: enabledVariationId,
            tags: [],
            currentUserId: Guid.NewGuid()
        );
    }

    private Segment CreateSegment(string key, string[] included)
    {
        // Environment-specific so GetEnvironmentIdsAsync resolves to [_envId] without any Mongo
        // env/project/org lookup — the env ids backfilled to the returning DC's index are deterministic.
        return new Segment(
            workspaceId: Guid.NewGuid(),
            envId: _envId,
            name: key,
            key: key,
            type: SegmentType.EnvironmentSpecific,
            scopes: [],
            included: included,
            excluded: [],
            rules: [],
            description: string.Empty
        );
    }

    private async Task UpsertLeaseAsync(string dcId, DateTimeOffset expiresAt)
    {
        await _leaseStore.UpsertLeaseAsync(new DcLease
        {
            DcId = dcId,
            Region = dcId,
            LastHeartbeatAt = DateTimeOffset.UtcNow,
            LeaseExpiresAt = expiresAt
        });
    }

    /// <summary>
    /// Seeds an Organization + Project + Environment in Mongo (#91) so
    /// <c>IEnvironmentService.GetSecretCachesAsync</c> can resolve a resource descriptor for it. The
    /// Environment constructor auto-creates its two default secrets (Server Key, Client Key). Fully
    /// qualified return type: <c>Environment</c> is ambiguous with <c>System.Environment</c> (used
    /// elsewhere in this file for <c>GetEnvironmentVariable</c>), so this file deliberately does not
    /// <c>using Domain.Environments;</c>.
    /// </summary>
    private async Task<Domain.Environments.Environment> CreateEnvironmentWithSecretsAsync()
    {
        var org = new Organization(Guid.NewGuid(), "org", $"org-{Guid.NewGuid():N}");
        await _mongoDb.CollectionOf<Organization>().InsertOneAsync(org);

        var project = new Project(org.Id, "project", $"project-{Guid.NewGuid():N}");
        await _mongoDb.CollectionOf<Project>().InsertOneAsync(project);

        var env = new Domain.Environments.Environment(project.Id, "env", $"env-{Guid.NewGuid():N}");
        await _environmentService.AddOneAsync(env);

        return env;
    }

    private RecoveryWorker CreateSut(
        ILogger<RecoveryWorker>? logger = null,
        bool isLeader = true,
        IFeatureFlagService? flagService = null,
        ISegmentService? segmentService = null,
        IEnvironmentService? environmentService = null)
    {
        // Wire IFeatureFlagService + ILeaseStore through a real DI scope, matching how the worker
        // resolves them at runtime via IServiceScopeFactory. Tests that need to observe how many
        // times the snapshot is fetched (#90) pass a counting spy in place of the real services.
        var services = new ServiceCollection();
        services.AddTransient(_ => flagService ?? (IFeatureFlagService)_flagService);
        services.AddTransient(_ => segmentService ?? (ISegmentService)_segmentService);
        services.AddTransient(_ => environmentService ?? (IEnvironmentService)_environmentService);
        services.AddTransient<ILeaseStore>(_ => _leaseStore);
        var provider = services.BuildServiceProvider();

        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ControlPlane:ConsistencyMode"] = "GatedCommit"
            })
            .Build();

        _producer = new RecordingMessageProducer();

        // The per-DC backfill body now lives in the shared DcBackfiller; the worker delegates to it.
        var backfiller = new DcBackfiller(
            provider.GetRequiredService<IServiceScopeFactory>(),
            _composite,
            _producer,
            NullLogger<DcBackfiller>.Instance);

        return new RecoveryWorker(
            provider.GetRequiredService<IServiceScopeFactory>(),
            backfiller,
            new FakeLeaderElection(isLeader),
            configuration,
            logger ?? NullLogger<RecoveryWorker>.Instance);
    }

    /// <summary>
    /// The committed version token the worker derives for a flag (mirrors
    /// FeatureFlagChangeMessageHandler / RecoveryWorker: unix-ms of UpdatedAt).
    /// </summary>
    private static long VersionTokenOf(FeatureFlag flag) =>
        new DateTimeOffset(flag.UpdatedAt).ToUnixTimeMilliseconds();

    /// <summary>Segment counterpart of <see cref="VersionTokenOf(FeatureFlag)"/>.</summary>
    private static long VersionTokenOf(Segment segment) =>
        new DateTimeOffset(segment.UpdatedAt).ToUnixTimeMilliseconds();

    // ----- acceptance -----

    [DockerFact]
    public async Task Backfills_ReturningDc_To_LatestCommittedVersion()
    {
        const string key = "returning-dc";

        // ---- v1 committed on BOTH DCs (both live) ----
        var v1 = CreateFlag(key, isEnabled: false);
        v1.CommittedVersion = 1;
        await _flagService.AddOneAsync(v1);
        var v1Ts = VersionTokenOf(v1);

        await _dcaCache.StageFlagAsync(v1, v1Ts);
        await _dcaCache.CommitFlagAsync(_envId, v1.Id.ToString(), v1Ts);
        await _dcbCache.StageFlagAsync(v1, v1Ts);
        await _dcbCache.CommitFlagAsync(_envId, v1.Id.ToString(), v1Ts);

        var now = DateTimeOffset.UtcNow;
        await UpsertLeaseAsync(DcA, now.AddMinutes(5));
        await UpsertLeaseAsync(DcB, now.AddMinutes(5));

        var sut = CreateSut();

        // First tick: both DCs first-seen -> backfilled (harmless), establishes the watermark.
        await sut.RunOnceAsync();

        // ---- dc-b loses its lease ----
        await UpsertLeaseAsync(DcB, now.AddMinutes(-5)); // expired

        // ---- flag changes to v2, committed on dc-a ONLY (dc-b absent) ----
        // The committed top-level value advances to v2 with NO pending (mirrors the coordinator
        // committing on the live set while dc-b is evicted).
        var v2 = CreateFlag(key, isEnabled: true);
        v2.Id = v1.Id;
        v2.CommittedVersion = 2;
        // ensure a distinct, newer version token than v1
        v2.UpdatedAt = v1.UpdatedAt.AddSeconds(1);
        await _flagService.UpdateAsync(v2);
        var v2Ts = VersionTokenOf(v2);
        Assert.NotEqual(v1Ts, v2Ts);

        await _dcaCache.StageFlagAsync(v2, v2Ts);
        await _dcaCache.CommitFlagAsync(_envId, v2.Id.ToString(), v2Ts);

        // dc-b is still at v1 and never got v2.
        Assert.False(await _dcbCache.HasStagedFlagAsync(v2.Id, v2Ts));
        var dcbPointerBefore = await _mux.GetDatabase(1).StringGetAsync(RedisKeys.FlagCommittedPointer(v2.Id));
        Assert.Equal(v1Ts, (long)dcbPointerBefore);

        // A recovery tick now sees only dc-a live; nothing returned.
        var noReturn = await sut.RunOnceAsync();
        Assert.Equal(0, noReturn);

        // ---- dc-b's lease returns ----
        await UpsertLeaseAsync(DcB, now.AddMinutes(5));

        var backfilled = await sut.RunOnceAsync();

        // exactly one DC (dc-b) backfilled
        Assert.Equal(1, backfilled);

        // dc-b's Redis now has v2: versioned value key + committed pointer + index all at v2.
        Assert.True(await _dcbCache.HasStagedFlagAsync(v2.Id, v2Ts));

        var dcbPointerAfter = await _mux.GetDatabase(1).StringGetAsync(RedisKeys.FlagCommittedPointer(v2.Id));
        Assert.Equal(v2Ts, (long)dcbPointerAfter);

        var dcbIndexScore = await _mux.GetDatabase(1)
            .SortedSetScoreAsync(RedisKeys.FlagIndex(_envId), v2.Id.ToString());
        Assert.NotNull(dcbIndexScore);
        Assert.Equal(v2Ts, (long)dcbIndexScore!.Value);

        // dc-a was untouched by the recovery (it was already live, not returning).
        var dcaPointer = await _mux.GetDatabase(0).StringGetAsync(RedisKeys.FlagCommittedPointer(v2.Id));
        Assert.Equal(v2Ts, (long)dcaPointer);
    }

    [DockerFact]
    public async Task Backfills_ReturningDc_With_LatestCommittedSegmentVersion()
    {
        const string flagKey = "returning-dc-flag";
        const string segmentKey = "returning-dc-segment";

        // ---- a flag at v1 on BOTH DCs so the existing flag backfill path is exercised alongside ----
        var flag = CreateFlag(flagKey, isEnabled: false);
        flag.CommittedVersion = 1;
        await _flagService.AddOneAsync(flag);
        var flagTs = VersionTokenOf(flag);
        await _dcaCache.StageFlagAsync(flag, flagTs);
        await _dcaCache.CommitFlagAsync(_envId, flag.Id.ToString(), flagTs);
        await _dcbCache.StageFlagAsync(flag, flagTs);
        await _dcbCache.CommitFlagAsync(_envId, flag.Id.ToString(), flagTs);

        // ---- segment v1 committed on BOTH DCs (both live) ----
        var s1 = CreateSegment(segmentKey, included: ["alice"]);
        s1.CommittedVersion = 1;
        await _segmentService.AddOneAsync(s1);
        var s1Ts = VersionTokenOf(s1);
        var envIds = await _segmentService.GetEnvironmentIdsAsync(s1);
        Assert.Equal(new[] { _envId }, envIds);

        await _dcaCache.StageSegmentAsync(s1, s1Ts);
        await _dcaCache.CommitSegmentAsync(envIds, s1.Id.ToString(), s1Ts);
        await _dcbCache.StageSegmentAsync(s1, s1Ts);
        await _dcbCache.CommitSegmentAsync(envIds, s1.Id.ToString(), s1Ts);

        var now = DateTimeOffset.UtcNow;
        await UpsertLeaseAsync(DcA, now.AddMinutes(5));
        await UpsertLeaseAsync(DcB, now.AddMinutes(5));

        var sut = CreateSut();

        // First tick: both DCs first-seen -> backfilled (harmless), establishes the watermark.
        await sut.RunOnceAsync();

        // ---- dc-b loses its lease ----
        await UpsertLeaseAsync(DcB, now.AddMinutes(-5)); // expired

        // ---- segment changes to v2, committed on dc-a ONLY (dc-b absent) ----
        var s2 = CreateSegment(segmentKey, included: ["alice", "bob"]);
        s2.Id = s1.Id;
        s2.CommittedVersion = 2;
        // ensure a distinct, newer version token than v1
        s2.UpdatedAt = s1.UpdatedAt.AddSeconds(1);
        await _segmentService.UpdateAsync(s2);
        var s2Ts = VersionTokenOf(s2);
        Assert.NotEqual(s1Ts, s2Ts);

        await _dcaCache.StageSegmentAsync(s2, s2Ts);
        await _dcaCache.CommitSegmentAsync(envIds, s2.Id.ToString(), s2Ts);

        // dc-b is still at v1 and never got v2.
        Assert.False(await _dcbCache.HasStagedSegmentAsync(s2.Id, s2Ts));
        var dcbPointerBefore =
            await _mux.GetDatabase(1).StringGetAsync(RedisKeys.SegmentCommittedPointer(s2.Id));
        Assert.Equal(s1Ts, (long)dcbPointerBefore);

        // A recovery tick now sees only dc-a live; nothing returned.
        var noReturn = await sut.RunOnceAsync();
        Assert.Equal(0, noReturn);

        // ---- dc-b's lease returns ----
        await UpsertLeaseAsync(DcB, now.AddMinutes(5));

        var backfilled = await sut.RunOnceAsync();

        // exactly one DC (dc-b) backfilled
        Assert.Equal(1, backfilled);

        // dc-b's Redis now has the segment at v2: versioned value key + committed pointer + index.
        Assert.True(await _dcbCache.HasStagedSegmentAsync(s2.Id, s2Ts));

        var dcbPointerAfter =
            await _mux.GetDatabase(1).StringGetAsync(RedisKeys.SegmentCommittedPointer(s2.Id));
        Assert.Equal(s2Ts, (long)dcbPointerAfter);

        var dcbIndexScore = await _mux.GetDatabase(1)
            .SortedSetScoreAsync(RedisKeys.SegmentIndex(_envId), s2.Id.ToString());
        Assert.NotNull(dcbIndexScore);
        Assert.Equal(s2Ts, (long)dcbIndexScore!.Value);

        // dc-a was untouched by the recovery (it was already live, not returning).
        var dcaPointer =
            await _mux.GetDatabase(0).StringGetAsync(RedisKeys.SegmentCommittedPointer(s2.Id));
        Assert.Equal(s2Ts, (long)dcaPointer);

        // the flag backfill still works (don't regress): dc-b has the flag committed at v1.
        Assert.True(await _dcbCache.HasStagedFlagAsync(flag.Id, flagTs));
        var dcbFlagPointer =
            await _mux.GetDatabase(1).StringGetAsync(RedisKeys.FlagCommittedPointer(flag.Id));
        Assert.Equal(flagTs, (long)dcbFlagPointer);
    }

    // ----- #91: secrets are backfilled to a returning DC too, unconditionally -----

    [DockerFact]
    public async Task Backfills_ReturningDc_With_Secrets()
    {
        var env = await CreateEnvironmentWithSecretsAsync();
        Assert.Equal(2, env.Secrets.Count);

        var now = DateTimeOffset.UtcNow;
        await UpsertLeaseAsync(DcA, now.AddMinutes(5));
        await UpsertLeaseAsync(DcB, now.AddMinutes(5));

        var sut = CreateSut();

        // First tick: both DCs first-seen -> backfilled, establishing the watermark; secrets land on
        // both dc-a and dc-b since both are "returning" on this first tick.
        await sut.RunOnceAsync();
        foreach (var secret in env.Secrets)
        {
            var key = RedisKeys.Secret(secret.Value);
            Assert.True(await _mux.GetDatabase(0).KeyExistsAsync(key));
            Assert.True(await _mux.GetDatabase(1).KeyExistsAsync(key));
        }

        // ---- dc-b loses its lease, and its secret keys are wiped (simulating the Redis data loss
        // #91 exists to repair) ----
        await UpsertLeaseAsync(DcB, now.AddMinutes(-5)); // expired
        await sut.RunOnceAsync();                        // dc-b drops out of the live set
        foreach (var secret in env.Secrets)
        {
            await _mux.GetDatabase(1).KeyDeleteAsync(RedisKeys.Secret(secret.Value));
        }

        // ---- dc-b returns: the recovery tick must restore its secrets, not just flags/segments
        // (none seeded in this test) ----
        await UpsertLeaseAsync(DcB, now.AddMinutes(5));
        var backfilled = await sut.RunOnceAsync();
        Assert.Equal(1, backfilled);

        foreach (var secret in env.Secrets)
        {
            var key = RedisKeys.Secret(secret.Value);
            Assert.True(await _mux.GetDatabase(1).KeyExistsAsync(key));

            var fields = (await _mux.GetDatabase(1).HashGetAllAsync(key))
                .ToDictionary(x => x.Name.ToString(), x => x.Value.ToString());
            Assert.Equal(secret.Type, fields["type"]);
            Assert.Equal(env.Id.ToString(), fields["envId"]);
        }

        // dc-a (never returning, always live) is untouched by this last tick — still has its secrets.
        foreach (var secret in env.Secrets)
        {
            Assert.True(await _mux.GetDatabase(0).KeyExistsAsync(RedisKeys.Secret(secret.Value)));
        }
    }

    [DockerFact]
    public async Task NoOp_When_NoDcReturned()
    {
        const string key = "steady-state";

        var v1 = CreateFlag(key, isEnabled: true);
        v1.CommittedVersion = 1;
        await _flagService.AddOneAsync(v1);
        var v1Ts = VersionTokenOf(v1);

        await _dcaCache.StageFlagAsync(v1, v1Ts);
        await _dcaCache.CommitFlagAsync(_envId, v1.Id.ToString(), v1Ts);
        await _dcbCache.StageFlagAsync(v1, v1Ts);
        await _dcbCache.CommitFlagAsync(_envId, v1.Id.ToString(), v1Ts);

        var now = DateTimeOffset.UtcNow;
        await UpsertLeaseAsync(DcA, now.AddMinutes(5));
        await UpsertLeaseAsync(DcB, now.AddMinutes(5));

        var sut = CreateSut();

        // First tick: both DCs are first-seen, so the recovery tick's backfill runs for both — but
        // #105: both dc-a's and dc-b's Redis ALREADY hold the exact v1 committed value (seeded
        // directly above, matching Mongo's v1 exactly), so the only-advance guard genuinely accepts
        // NOTHING (same version, not strictly newer) for either DC. The tick still establishes the
        // watermark (see the second tick below), but honestly reports 0 repairs — neither DC needed
        // one. This is the #105 fix working as intended: before it, RecoveryWorker counted any
        // non-skipped backfill as a repair regardless of whether anything actually changed.
        var first = await sut.RunOnceAsync();
        Assert.Equal(0, first);

        // Second tick with the SAME live set: nothing returned -> no-op.
        var second = await sut.RunOnceAsync();
        Assert.Equal(0, second);
    }

    // ----- #90: one shared committed snapshot per tick -----

    [DockerFact]
    public async Task TwoDcsReturnedInOneTick_ShareOneCommittedSnapshotFetch()
    {
        const string flagKey = "shared-snapshot-flag";
        const string segmentKey = "shared-snapshot-segment";

        var flag = CreateFlag(flagKey, isEnabled: true);
        flag.CommittedVersion = 1;
        await _flagService.AddOneAsync(flag);
        var flagTs = VersionTokenOf(flag);

        var segment = CreateSegment(segmentKey, included: ["alice"]);
        segment.CommittedVersion = 1;
        await _segmentService.AddOneAsync(segment);
        var segmentTs = VersionTokenOf(segment);

        // #91: seed an environment (with its auto-created default secrets) too, so the shared
        // snapshot's secret enumeration is exercised alongside flags/segments.
        var env = await CreateEnvironmentWithSecretsAsync();

        // Both DCs start absent (no lease at all): a SINGLE tick sees both as newly live/returned
        // together, so the shared-snapshot path is exercised (not the sequential-returns path the
        // other acceptance tests exercise).
        var now = DateTimeOffset.UtcNow;
        await UpsertLeaseAsync(DcA, now.AddMinutes(5));
        await UpsertLeaseAsync(DcB, now.AddMinutes(5));

        // Counting spies around the REAL Mongo-backed services: prove GetAllCommittedAsync /
        // GetSecretCachesAsync is called exactly once per tick (not once per returned DC) while still
        // exercising the real read path.
        var (flagServiceSpy, flagCommittedCalls) =
            CountingProxy<IFeatureFlagService>.Wrap(_flagService, nameof(IFeatureFlagService.GetAllCommittedAsync));
        var (segmentServiceSpy, segmentCommittedCalls) =
            CountingProxy<ISegmentService>.Wrap(_segmentService, nameof(ISegmentService.GetAllCommittedAsync));
        var (environmentServiceSpy, secretCacheCalls) =
            CountingProxy<IEnvironmentService>.Wrap(_environmentService, nameof(IEnvironmentService.GetSecretCachesAsync));

        var sut = CreateSut(
            flagService: flagServiceSpy,
            segmentService: segmentServiceSpy,
            environmentService: environmentServiceSpy);

        var backfilled = await sut.RunOnceAsync();

        Assert.Equal(2, backfilled);
        Assert.Equal(1, flagCommittedCalls.CallCount);
        Assert.Equal(1, segmentCommittedCalls.CallCount);
        Assert.Equal(1, secretCacheCalls.CallCount);

        // Both DCs were written from the IDENTICAL shared snapshot: same committed pointer (ts) for
        // both the flag and the segment on both DCs.
        var dcaFlagPointer = await _mux.GetDatabase(0).StringGetAsync(RedisKeys.FlagCommittedPointer(flag.Id));
        var dcbFlagPointer = await _mux.GetDatabase(1).StringGetAsync(RedisKeys.FlagCommittedPointer(flag.Id));
        Assert.Equal(flagTs, (long)dcaFlagPointer);
        Assert.Equal(flagTs, (long)dcbFlagPointer);

        var dcaSegmentPointer =
            await _mux.GetDatabase(0).StringGetAsync(RedisKeys.SegmentCommittedPointer(segment.Id));
        var dcbSegmentPointer =
            await _mux.GetDatabase(1).StringGetAsync(RedisKeys.SegmentCommittedPointer(segment.Id));
        Assert.Equal(segmentTs, (long)dcaSegmentPointer);
        Assert.Equal(segmentTs, (long)dcbSegmentPointer);

        // Both DCs also got the same secrets from the one shared snapshot.
        foreach (var secret in env.Secrets)
        {
            var secretKey = RedisKeys.Secret(secret.Value);
            Assert.True(await _mux.GetDatabase(0).KeyExistsAsync(secretKey));
            Assert.True(await _mux.GetDatabase(1).KeyExistsAsync(secretKey));
        }
    }

    [DockerFact]
    public async Task Publishes_Targeted_ClientRefresh_For_ReturningDc()
    {
        const string key = "returning-dc-refresh";

        // ---- v1 committed on BOTH DCs (both live) ----
        var v1 = CreateFlag(key, isEnabled: false);
        v1.CommittedVersion = 1;
        await _flagService.AddOneAsync(v1);
        var v1Ts = VersionTokenOf(v1);

        await _dcaCache.StageFlagAsync(v1, v1Ts);
        await _dcaCache.CommitFlagAsync(_envId, v1.Id.ToString(), v1Ts);
        await _dcbCache.StageFlagAsync(v1, v1Ts);
        await _dcbCache.CommitFlagAsync(_envId, v1.Id.ToString(), v1Ts);

        var now = DateTimeOffset.UtcNow;
        await UpsertLeaseAsync(DcA, now.AddMinutes(5));
        await UpsertLeaseAsync(DcB, now.AddMinutes(5));

        var sut = CreateSut();

        // First tick: both DCs first-seen -> both backfilled -> a targeted command per DC.
        await sut.RunOnceAsync();

        var firstTickCommands = _producer.Published
            .Where(p => p.Topic == ControlPlaneTopics.ControlPlaneCommand)
            .Select(p => (ControlPlaneCommand)p.Message)
            .ToList();
        Assert.Equal(2, firstTickCommands.Count);
        Assert.All(firstTickCommands, c => Assert.Equal(Action.PushFullSync, c.Action));
        Assert.Contains(firstTickCommands, c => c.TargetDcId == DcA);
        Assert.Contains(firstTickCommands, c => c.TargetDcId == DcB);

        // ---- steady state: same live set -> nothing returned -> NO new commands published ----
        var publishedBefore = _producer.Published.Count;
        var noReturn = await sut.RunOnceAsync();
        Assert.Equal(0, noReturn);
        Assert.Equal(publishedBefore, _producer.Published.Count);

        // ---- dc-b leaves then returns -> exactly one targeted command, for dc-b only ----
        await UpsertLeaseAsync(DcB, now.AddMinutes(-5)); // expired
        await sut.RunOnceAsync();                        // dc-b drops out of the live set (no return)
        var beforeReturn = _producer.Published.Count;

        await UpsertLeaseAsync(DcB, now.AddMinutes(5));  // dc-b returns
        var backfilled = await sut.RunOnceAsync();
        // #105: dc-b's Redis was NEVER wiped/changed while it was absent — it still holds the exact
        // v1 value that still matches Mongo's v1 committed snapshot, so the only-advance guard
        // genuinely accepts nothing (same version). RecoveryWorker honestly reports 0 repairs, NOT 1
        // — but the targeted PushFullSync client refresh below is still published unconditionally
        // (DcBackfiller always publishes it after a backfill run, independent of whether the guard
        // accepted anything), so a returning DC's connected SDK clients still get refreshed even on
        // a "nothing changed" backfill.
        Assert.Equal(0, backfilled);

        var returnCommands = _producer.Published
            .Skip(beforeReturn)
            .Where(p => p.Topic == ControlPlaneTopics.ControlPlaneCommand)
            .Select(p => (ControlPlaneCommand)p.Message)
            .ToList();
        var refresh = Assert.Single(returnCommands);
        Assert.Equal(Action.PushFullSync, refresh.Action);
        Assert.Equal(DcB, refresh.TargetDcId);
    }

    // ----- #71b leader gating -----

    [DockerFact]
    public async Task Recovery_NotLeader_SkipsTick()
    {
        const string key = "not-leader-recovery";

        // ---- v1 committed on BOTH DCs (both live) ----
        var v1 = CreateFlag(key, isEnabled: false);
        v1.CommittedVersion = 1;
        await _flagService.AddOneAsync(v1);
        var v1Ts = VersionTokenOf(v1);

        await _dcaCache.StageFlagAsync(v1, v1Ts);
        await _dcaCache.CommitFlagAsync(_envId, v1.Id.ToString(), v1Ts);
        // dc-b intentionally NOT staged/committed -> it would be "returned" and backfilled if a
        // leader ran this tick.

        var now = DateTimeOffset.UtcNow;
        await UpsertLeaseAsync(DcA, now.AddMinutes(5));
        await UpsertLeaseAsync(DcB, now.AddMinutes(5));

        var sut = CreateSut(isLeader: false);

        var backfilled = await sut.RunOnceAsync();

        Assert.Equal(0, backfilled);
        Assert.Empty(_producer.Published);

        // dc-b was never backfilled: still missing the flag entirely.
        Assert.False(await _dcbCache.HasStagedFlagAsync(v1.Id, v1Ts));
    }

    // ----- test doubles -----

    /// <summary>
    /// Spy <see cref="IMessageProducer"/> that records every (topic, message) published, so a test can
    /// assert the per-DC client-refresh <see cref="ControlPlaneCommand"/> was published after backfill.
    /// </summary>
    private sealed class RecordingMessageProducer : IMessageProducer
    {
        public List<(string Topic, object Message)> Published { get; } = new();

        public Task PublishAsync<TMessage>(string topic, TMessage message) where TMessage : class
        {
            Published.Add((topic, message));
            return Task.CompletedTask;
        }
    }

    private sealed class TestRedisClient(IConnectionMultiplexer connection, int db) : IRedisClient
    {
        public IConnectionMultiplexer Connection { get; } = connection;

        public IDatabase GetDatabase() => Connection.GetDatabase(db);
    }

    /// <summary>
    /// A thread-safe call counter paired with a <see cref="DispatchProxy"/> that forwards every call
    /// on <typeparamref name="TInterface"/> to a REAL wrapped instance, incrementing only for the one
    /// named method being spied on. Used (#90) to prove the shared committed snapshot is fetched
    /// exactly once per tick — i.e. <c>GetAllCommittedAsync</c> is invoked once, not once per returned
    /// DC — while the test still exercises the real Mongo-backed service underneath.
    /// </summary>
    public class CountingProxy<TInterface> : DispatchProxy where TInterface : class
    {
        private TInterface _target = null!;
        private string _countedMethodName = string.Empty;
        private int _callCount;

        public int CallCount => Volatile.Read(ref _callCount);

        public static (TInterface Proxy, CountingProxy<TInterface> Counter) Wrap(
            TInterface target,
            string countedMethodName)
        {
            var proxy = Create<TInterface, CountingProxy<TInterface>>();
            var counter = (CountingProxy<TInterface>)(object)proxy;
            counter._target = target;
            counter._countedMethodName = countedMethodName;
            return (proxy, counter);
        }

        protected override object? Invoke(MethodInfo? targetMethod, object?[]? args)
        {
            if (targetMethod is null)
            {
                throw new InvalidOperationException("CountingProxy received a null target method.");
            }

            if (targetMethod.Name == _countedMethodName)
            {
                Interlocked.Increment(ref _callCount);
            }

            return targetMethod.Invoke(_target, args);
        }
    }
}

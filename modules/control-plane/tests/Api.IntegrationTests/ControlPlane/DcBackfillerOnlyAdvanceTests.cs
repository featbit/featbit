using Api.Application.ControlPlane;
using Api.Infrastructure.Caches;
using Api.IntegrationTests.Fixtures;
using Application.ControlPlane;
using Application.Services;
using Domain.FeatureFlags;
using Domain.Messages;
using Domain.Organizations;
using Domain.Projects;
using Infrastructure.Caches.Redis;
using Infrastructure.Persistence.MongoDb;
using Infrastructure.Services.MongoDb;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using MongoDB.Bson;
using StackExchange.Redis;

namespace Api.IntegrationTests.ControlPlane;

/// <summary>
/// #89 acceptance: DcBackfiller.BackfillDcAsync snapshots the source of truth (Mongo) once, then
/// awaits per-item targeted writes. If a fresher commit lands on the target DC's Redis AFTER that
/// snapshot was taken but BEFORE the backfill's (now-stale) write for the same flag/segment arrives,
/// an unconditional write would revert the DC back to the stale snapshot. This exercises the
/// only-advance guard end-to-end via the real DcBackfiller against real infrastructure: a real
/// MongoDB (the "stale snapshot" it reads) and a real Redis DC (holding a fresher committed value
/// than the Mongo snapshot, simulating the race).
///
/// Uses shared Testcontainers MongoDB and Redis fixtures; Redis logical DB indexes simulate DCs.
/// </summary>
[Collection(MongoRedisCollection.Name)]
public sealed class DcBackfillerOnlyAdvanceTests : IntegrationTestBase, IAsyncLifetime
{
    private readonly MongoDbFixture _mongoFixture;
    private readonly RedisFixture _redisFixture;

    private const string DcA = "dc-a";
    private const string DcB = "dc-b";

    private readonly string _dbName = $"featbit_89_test_{Guid.NewGuid():N}";
    private readonly Guid _envId = Guid.NewGuid();

    private MongoDbClient _mongoDb = null!;
    private FeatureFlagService _flagService = null!;
    private SegmentService _segmentService = null!;
    private EnvironmentService _environmentService = null!;

    private ConnectionMultiplexer _mux = null!;
    private RedisCacheService _dcbCache = null!; // db 1 -- the DC under backfill in these tests
    private CompositeRedisCacheService _composite = null!;

    public DcBackfillerOnlyAdvanceTests(MongoDbFixture mongoFixture, RedisFixture redisFixture)
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

        var redisOptions = ConfigurationOptions.Parse(_redisFixture.ConnectionString);
        redisOptions.AllowAdmin = true;

        _mux = await ConnectionMultiplexer.ConnectAsync(redisOptions);
        await _mux.GetDatabase(0).ExecuteAsync("FLUSHDB");
        await _mux.GetDatabase(1).ExecuteAsync("FLUSHDB");

        var dcaCache = new RedisCacheService(new TestRedisClient(_mux, db: 0));
        _dcbCache = new RedisCacheService(new TestRedisClient(_mux, db: 1));

        _composite = new CompositeRedisCacheService(
            new[]
            {
                new DcCacheService(DcA, dcaCache),
                new DcCacheService(DcB, _dcbCache)
            },
            NullLogger<CompositeRedisCacheService>.Instance);
    }

    public async Task DisposeAsync()
    {
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

    private static long VersionTokenOf(FeatureFlag flag) =>
        new DateTimeOffset(flag.UpdatedAt).ToUnixTimeMilliseconds();

    /// <summary>
    /// Seeds an Organization + Project + Environment in Mongo (#91) so
    /// <c>IEnvironmentService.GetSecretCachesAsync</c> can resolve a resource descriptor for it. The
    /// Environment constructor auto-creates its two default secrets (Server Key, Client Key) exactly
    /// like a real environment, so no separate secret-seeding step is needed. Fully-qualified return
    /// type: <c>Environment</c> is ambiguous with <c>System.Environment</c> (used elsewhere in this
    /// file for <c>GetEnvironmentVariable</c>), so this file deliberately does not
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

    private DcBackfiller CreateBackfiller(IMessageProducer producer)
    {
        var services = new ServiceCollection();
        services.AddTransient<IFeatureFlagService>(_ => _flagService);
        services.AddTransient<ISegmentService>(_ => _segmentService);
        services.AddTransient<IEnvironmentService>(_ => _environmentService);
        var provider = services.BuildServiceProvider();

        return new DcBackfiller(
            provider.GetRequiredService<IServiceScopeFactory>(),
            _composite,
            producer,
            NullLogger<DcBackfiller>.Instance);
    }

    // ----- acceptance -----

    [DockerFact]
    public async Task GatedCommit_BackfillHoldingStaleSnapshot_CannotRevertFresherCommittedPointer()
    {
        const string key = "stale-snapshot-flag";

        // ---- the source of truth (Mongo) still reflects the OLDER ts1 value: this is the
        // "stale snapshot" DcBackfiller.GetAllCommittedAsync will read. ----
        var flagAtTs1 = CreateFlag(key, isEnabled: false);
        await _flagService.AddOneAsync(flagAtTs1);
        var ts1 = VersionTokenOf(flagAtTs1);

        // ---- dc-b's Redis is ALREADY at the fresher ts2 (simulates a racing normal commit that
        // landed on dc-b after the backfill's Mongo snapshot was taken but before its write for
        // ts1 arrived). ----
        var flagAtTs2 = CreateFlag(key, isEnabled: true);
        flagAtTs2.Id = flagAtTs1.Id;
        flagAtTs2.UpdatedAt = flagAtTs1.UpdatedAt.AddSeconds(1);
        var ts2 = VersionTokenOf(flagAtTs2);
        Assert.True(ts2 > ts1);

        await _dcbCache.StageFlagAsync(flagAtTs2, ts2);
        await _dcbCache.CommitFlagAsync(_envId, flagAtTs2.Id.ToString(), ts2);

        var pointerKey = RedisKeys.FlagCommittedPointer(flagAtTs2.Id);
        Assert.Equal(ts2, (long)(await _mux.GetDatabase(1).StringGetAsync(pointerKey)));

        // ---- the backfill runs, holding the STALE ts1 Mongo snapshot ----
        var backfiller = CreateBackfiller(new NoopMessageProducer());
        var flagCount = await backfiller.BackfillDcAsync(DcB, ConsistencyMode.GatedCommit);
        // #105: BackfillDcAsync now returns the ACCEPTED count, not the attempted count. The one
        // flag attempted here was genuinely guard-rejected (dc-b already held the fresher ts2), so
        // the honest count is 0 — asserting 1 (the old "attempted" behavior) would hide exactly the
        // dishonest-metrics bug #105 exists to fix.
        Assert.Equal(0, flagCount);

        // ACCEPTANCE: dc-b's committed pointer + index must still read ts2 — the stale backfill
        // write for ts1 must have been rejected by the only-advance guard, not reverted the DC.
        var pointerAfter = await _mux.GetDatabase(1).StringGetAsync(pointerKey);
        Assert.Equal(ts2, (long)pointerAfter);

        var indexScore = await _mux.GetDatabase(1)
            .SortedSetScoreAsync(RedisKeys.FlagIndex(_envId), flagAtTs2.Id.ToString());
        Assert.NotNull(indexScore);
        Assert.Equal(ts2, (long)indexScore!.Value);

        // the newer (ts2) staged version is still what's readable, not the stale ts1 one.
        Assert.True(await _dcbCache.HasStagedFlagAsync(flagAtTs2.Id, ts2));
    }

    [DockerFact]
    public async Task GatedCommit_BackfillHoldingStaleSnapshot_CannotRevertFresherCommittedSegmentPointer()
    {
        const string key = "stale-snapshot-segment";

        var segmentAtTs1 = new Domain.Segments.Segment(
            workspaceId: Guid.NewGuid(),
            envId: _envId,
            name: key,
            key: key,
            type: Domain.Segments.SegmentType.EnvironmentSpecific,
            scopes: [],
            included: ["alice"],
            excluded: [],
            rules: [],
            description: string.Empty
        );
        await _segmentService.AddOneAsync(segmentAtTs1);
        var envIds = await _segmentService.GetEnvironmentIdsAsync(segmentAtTs1);
        var ts1 = new DateTimeOffset(segmentAtTs1.UpdatedAt).ToUnixTimeMilliseconds();

        var segmentAtTs2 = new Domain.Segments.Segment(
            workspaceId: segmentAtTs1.WorkspaceId,
            envId: _envId,
            name: key,
            key: key,
            type: Domain.Segments.SegmentType.EnvironmentSpecific,
            scopes: [],
            included: ["alice", "bob"],
            excluded: [],
            rules: [],
            description: string.Empty
        )
        {
            Id = segmentAtTs1.Id,
            UpdatedAt = segmentAtTs1.UpdatedAt.AddSeconds(1)
        };
        var ts2 = new DateTimeOffset(segmentAtTs2.UpdatedAt).ToUnixTimeMilliseconds();
        Assert.True(ts2 > ts1);

        // dc-b is already at the fresher ts2 (raced ahead of the backfill's stale Mongo snapshot).
        await _dcbCache.StageSegmentAsync(segmentAtTs2, ts2);
        await _dcbCache.CommitSegmentAsync(envIds, segmentAtTs2.Id.ToString(), ts2);

        var pointerKey = RedisKeys.SegmentCommittedPointer(segmentAtTs2.Id);
        Assert.Equal(ts2, (long)(await _mux.GetDatabase(1).StringGetAsync(pointerKey)));

        var backfiller = CreateBackfiller(new NoopMessageProducer());
        var flagCount = await backfiller.BackfillDcAsync(DcB, ConsistencyMode.GatedCommit);
        Assert.Equal(0, flagCount); // no flags seeded in this test, only the segment

        // ACCEPTANCE: dc-b's segment pointer + index must still read ts2, not reverted to ts1.
        var pointerAfter = await _mux.GetDatabase(1).StringGetAsync(pointerKey);
        Assert.Equal(ts2, (long)pointerAfter);

        var indexScore = await _mux.GetDatabase(1)
            .SortedSetScoreAsync(RedisKeys.SegmentIndex(_envId), segmentAtTs2.Id.ToString());
        Assert.NotNull(indexScore);
        Assert.Equal(ts2, (long)indexScore!.Value);
    }

    [DockerFact]
    public async Task BestEffort_BackfillHoldingStaleSnapshot_CannotRevertFresherLegacyUpsert()
    {
        const string key = "stale-snapshot-besteffort-flag";

        // Mongo (the backfill's snapshot) still reflects the OLDER, disabled ts1 value.
        var flagAtTs1 = CreateFlag(key, isEnabled: false);
        await _flagService.AddOneAsync(flagAtTs1);
        var ts1 = VersionTokenOf(flagAtTs1);

        // dc-b's Redis already has the fresher, enabled ts2 value (raced ahead via a normal
        // BestEffort upsert that isn't gated on a snapshot).
        var flagAtTs2 = CreateFlag(key, isEnabled: true);
        flagAtTs2.Id = flagAtTs1.Id;
        flagAtTs2.UpdatedAt = flagAtTs1.UpdatedAt.AddSeconds(1);
        var ts2 = VersionTokenOf(flagAtTs2);
        Assert.True(ts2 > ts1);

        await _dcbCache.UpsertFlagAsync(flagAtTs2);

        var valueKey = RedisKeys.Flag(flagAtTs2.Id);
        var storedBefore = (string?)await _mux.GetDatabase(1).StringGetAsync(valueKey);
        Assert.Contains("\"isEnabled\":true", storedBefore);

        var backfiller = CreateBackfiller(new NoopMessageProducer());
        var flagCount = await backfiller.BackfillDcAsync(DcB, ConsistencyMode.BestEffort);
        // #105: ACCEPTED, not attempted — the one flag attempted here was genuinely guard-rejected
        // (dc-b already held the fresher ts2), so the honest count is 0.
        Assert.Equal(0, flagCount);

        // ACCEPTANCE: the legacy key must still read the ts2 (enabled) content and the index score
        // must still be ts2 — the backfill's stale ts1 upsert must have been rejected.
        var storedAfter = (string?)await _mux.GetDatabase(1).StringGetAsync(valueKey);
        Assert.Contains("\"isEnabled\":true", storedAfter);

        var indexScore = await _mux.GetDatabase(1)
            .SortedSetScoreAsync(RedisKeys.FlagIndex(_envId), flagAtTs2.Id.ToString());
        Assert.NotNull(indexScore);
        Assert.Equal(ts2, (long)indexScore!.Value);
    }

    // ----- #91 acceptance: secrets are backfilled unconditionally, in both modes -----

    [DockerTheory]
    [InlineData(ConsistencyMode.GatedCommit)]
    [InlineData(ConsistencyMode.BestEffort)]
    public async Task Backfill_WritesSecrets_ToTargetDcOnly_RegardlessOfMode(ConsistencyMode mode)
    {
        // Seed an environment (with its two auto-created default secrets) in the source of truth.
        var env = await CreateEnvironmentWithSecretsAsync();
        Assert.Equal(2, env.Secrets.Count);

        // dc-a starts with NOTHING (never wiped, just never written) and dc-b likewise: prove the
        // backfill writes ONLY to the target DC (dc-b), never dc-a.
        var backfiller = CreateBackfiller(new NoopMessageProducer());
        var repairedCount = await backfiller.BackfillDcAsync(DcB, mode);
        // #105: BackfillDcAsync's return is the TOTAL genuine-write count (accepted flags + accepted
        // segments + secrets written) — no flags/segments seeded here, but secrets are unconditional
        // (no guard), so every one of the 2 seeded secrets counts.
        Assert.Equal(2, repairedCount);

        foreach (var secret in env.Secrets)
        {
            var key = RedisKeys.Secret(secret.Value);

            // ACCEPTANCE: the secret's hash is present on dc-b (db 1) with the correct fields...
            var fields = (await _mux.GetDatabase(1).HashGetAllAsync(key))
                .ToDictionary(x => x.Name.ToString(), x => x.Value.ToString());
            Assert.Equal(secret.Type, fields["type"]);
            Assert.Equal(env.Id.ToString(), fields["envId"]);
            Assert.Equal(env.Key, fields["envKey"]);

            // ...and ABSENT on dc-a (db 0) — this backfill targeted dc-b only.
            Assert.False(await _mux.GetDatabase(0).KeyExistsAsync(key));
        }
    }

    [DockerFact]
    public async Task Backfill_RepairsSecrets_AfterTargetDcSecretKeysAreWiped()
    {
        var env = await CreateEnvironmentWithSecretsAsync();
        var secretKeys = env.Secrets.Select(s => (RedisKey)RedisKeys.Secret(s.Value)).ToArray();

        // Populate dc-b normally first (simulating steady state before the "outage")...
        foreach (var secret in env.Secrets)
        {
            var descriptor = (await _environmentService.GetSecretCachesAsync())
                .First(c => c.Secret.Id == secret.Id).Descriptor;
            await _dcbCache.UpsertSecretAsync(descriptor, secret);
        }
        foreach (var key in secretKeys)
        {
            Assert.True(await _mux.GetDatabase(1).KeyExistsAsync(key));
        }

        // ...then wipe dc-b's secret keys only (simulating the cache-loss #91 exists for) while
        // flags/segments are untouched (none seeded here — this test is secrets-only).
        foreach (var key in secretKeys)
        {
            await _mux.GetDatabase(1).KeyDeleteAsync(key);
        }
        foreach (var key in secretKeys)
        {
            Assert.False(await _mux.GetDatabase(1).KeyExistsAsync(key));
        }

        // A backfill (as the recovery worker / cache reconciler would run) must restore them.
        var backfiller = CreateBackfiller(new NoopMessageProducer());
        await backfiller.BackfillDcAsync(DcB, ConsistencyMode.GatedCommit);

        foreach (var key in secretKeys)
        {
            Assert.True(await _mux.GetDatabase(1).KeyExistsAsync(key));
        }
    }

    private sealed class NoopMessageProducer : IMessageProducer
    {
        public Task PublishAsync<TMessage>(string topic, TMessage message) where TMessage : class =>
            Task.CompletedTask;
    }

    private sealed class TestRedisClient(IConnectionMultiplexer connection, int db) : IRedisClient
    {
        public IConnectionMultiplexer Connection { get; } = connection;

        public IDatabase GetDatabase() => Connection.GetDatabase(db);
    }
}

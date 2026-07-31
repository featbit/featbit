using Api.IntegrationTests.Stubs;
using Api.Application.ControlPlane;
using Api.Infrastructure.Caches;
using Api.IntegrationTests.Fixtures;
using Application.Caches;
using Application.ControlPlane;
using Application.Services;
using Domain.ControlPlane;
using Domain.FeatureFlags;
using Domain.Messages;
using Infrastructure.Caches.Redis;
using Infrastructure.Persistence.MongoDb;
using Infrastructure.Services.MongoDb;
using System.Diagnostics.Metrics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using MongoDB.Bson;
using StackExchange.Redis;

namespace Api.IntegrationTests.ControlPlane;

/// <summary>
/// C3b-2 commit coordinator acceptance tests. Exercises the locked design end-to-end against real
/// infrastructure: a real MongoDB (pending flags + DC leases) and a real Redis whose two logical DB
/// indexes simulate two DCs' Redis (dc-a = db 0, dc-b = db 1). The coordinator commits a pending
/// version only once EVERY live DC has it staged.
///
/// Uses shared Testcontainers MongoDB and Redis fixtures; Redis logical DB indexes simulate DCs.
/// </summary>
[Collection(MongoRedisCollection.Name)]
public sealed class CommitCoordinatorWorkerTests : IntegrationTestBase, IAsyncLifetime
{
    private readonly MongoDbFixture _mongoFixture;
    private readonly RedisFixture _redisFixture;

    private const string DcA = "dc-a";
    private const string DcB = "dc-b";

    private readonly string _dbName = $"featbit_c3b2_test_{Guid.NewGuid():N}";
    private readonly Guid _envId = Guid.NewGuid();

    private MongoDbClient _mongoDb = null!;
    private FeatureFlagService _flagService = null!;
    private MongoLeaseStore _leaseStore = null!;

    private ConnectionMultiplexer _mux = null!;
    private RedisCacheService _dcaCache = null!; // db 0
    private RedisCacheService _dcbCache = null!; // db 1
    private CompositeRedisCacheService _composite = null!;

    public CommitCoordinatorWorkerTests(MongoDbFixture mongoFixture, RedisFixture redisFixture)
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

    /// <summary>Seeds a committed flag (v1, disabled) with a staged pending change (v2, enabled).</summary>
    private async Task<(FeatureFlag committed, FeatureFlag pendingValue, long pendingVersion)> SeedCommittedV1PendingV2(string key)
    {
        var committed = CreateFlag(key, isEnabled: false);
        committed.CommittedVersion = 1;
        await _flagService.AddOneAsync(committed);

        // the pending value is an edit of the SAME flag entity, so it carries the same Id (the
        // staged Redis key and the coordinator's probe are both keyed on flag.Id)
        var pendingValue = CreateFlag(key, isEnabled: true);
        pendingValue.Id = committed.Id;
        const long pendingVersion = 2;
        await _flagService.SetPendingAsync(_envId, key, pendingValue, pendingVersion);

        return (committed, pendingValue, pendingVersion);
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

    private CommitCoordinatorWorker CreateSut(
        SpyMessageProducer producer,
        ILogger<CommitCoordinatorWorker>? logger = null,
        bool isLeader = true)
    {
        // Wire IFeatureFlagService + ILeaseStore through a real DI scope, matching how the worker
        // resolves them at runtime via IServiceScopeFactory. ISegmentService is also registered
        // (always present in the real app); these flag-only tests seed no pending segments, so the
        // coordinator's segment loop is a no-op.
        var services = new ServiceCollection();
        services.AddTransient<IFeatureFlagService>(_ => _flagService);
        services.AddTransient<ILeaseStore>(_ => _leaseStore);
        services.AddTransient<ISegmentService>(_ => new SegmentService(_mongoDb, NullLogger<SegmentService>.Instance));
        var provider = services.BuildServiceProvider();

        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ControlPlane:ConsistencyMode"] = "GatedCommit"
            })
            .Build();

        return new CommitCoordinatorWorker(
            provider.GetRequiredService<IServiceScopeFactory>(),
            _composite,
            producer,
            new FakeLeaderElection(isLeader),
            configuration,
            logger ?? NullLogger<CommitCoordinatorWorker>.Instance);
    }

    // ----- acceptance cases -----

    [DockerFact]
    public async Task NoCommit_When_OnlyOneOfTwoLiveDcs_HasStaged()
    {
        const string key = "only-one-dc-staged";
        var (_, _, v) = await SeedCommittedV1PendingV2(key);
        var flag = await _flagService.GetAsync(_envId, key);

        // both DCs are live
        var now = DateTimeOffset.UtcNow;
        await UpsertLeaseAsync(DcA, now.AddMinutes(5));
        await UpsertLeaseAsync(DcB, now.AddMinutes(5));

        // only dc-a (db 0) has v2 staged
        await _dcaCache.StageFlagAsync(flag.Pending!.Value, v);

        var producer = new SpyMessageProducer();
        var sut = CreateSut(producer);

        var committed = await sut.RunOnceAsync();

        Assert.Equal(0, committed);
        Assert.Empty(producer.Published);

        // committed read still returns the OLD value; pending intact
        var read = await _flagService.GetCommittedAsync(_envId, key);
        Assert.False(read.IsEnabled);
        Assert.Equal(1, read.CommittedVersion);

        var raw = await _flagService.GetAsync(_envId, key);
        Assert.NotNull(raw.Pending);
        Assert.Equal(v, raw.Pending!.Version);

        // dc-b committed pointer never advanced
        Assert.False(await _dcbCache.HasStagedFlagAsync(flag.Id, v));
    }

    [DockerFact]
    public async Task Commits_When_AllLiveDcs_HaveStaged()
    {
        const string key = "all-dcs-staged";
        var (_, _, v) = await SeedCommittedV1PendingV2(key);
        var flag = await _flagService.GetAsync(_envId, key);

        var now = DateTimeOffset.UtcNow;
        await UpsertLeaseAsync(DcA, now.AddMinutes(5));
        await UpsertLeaseAsync(DcB, now.AddMinutes(5));

        // both DCs have v2 staged
        await _dcaCache.StageFlagAsync(flag.Pending!.Value, v);
        await _dcbCache.StageFlagAsync(flag.Pending!.Value, v);

        var producer = new SpyMessageProducer();
        var sut = CreateSut(producer);

        var committed = await sut.RunOnceAsync();

        Assert.Equal(1, committed);

        // committed read now returns the NEW value + advanced version
        var read = await _flagService.GetCommittedAsync(_envId, key);
        Assert.True(read.IsEnabled);
        Assert.Equal(v, read.CommittedVersion);

        // pending slot cleared
        var raw = await _flagService.GetAsync(_envId, key);
        Assert.Null(raw.Pending);

        // committed pointer advanced in BOTH DCs (broadcast)
        var dcaPointer = await _mux.GetDatabase(0).StringGetAsync(RedisKeys.FlagCommittedPointer(flag.Id));
        var dcbPointer = await _mux.GetDatabase(1).StringGetAsync(RedisKeys.FlagCommittedPointer(flag.Id));
        Assert.Equal(v, (long)dcaPointer);
        Assert.Equal(v, (long)dcbPointer);

        // published to the evaluation-server topic with the new committed value
        var publish = Assert.Single(producer.Published);
        Assert.Equal(Topics.FeatureFlagChange, publish.Topic);
        var publishedFlag = Assert.IsType<FeatureFlag>(publish.Message);
        Assert.True(publishedFlag.IsEnabled);
        Assert.Equal(flag.Id, publishedFlag.Id);
    }

    [DockerFact]
    public async Task Commits_Ignoring_ExpiredDc_When_OnlyLiveDc_HasStaged()
    {
        const string key = "expired-dc-ignored";
        var (_, _, v) = await SeedCommittedV1PendingV2(key);
        var flag = await _flagService.GetAsync(_envId, key);

        var now = DateTimeOffset.UtcNow;
        await UpsertLeaseAsync(DcA, now.AddMinutes(5));   // dc-a live
        await UpsertLeaseAsync(DcB, now.AddMinutes(-5));  // dc-b lease EXPIRED

        // only the live DC (dc-a) has v2 staged; dc-b never got it (but it's dead anyway)
        await _dcaCache.StageFlagAsync(flag.Pending!.Value, v);

        var producer = new SpyMessageProducer();
        var sut = CreateSut(producer);

        var committed = await sut.RunOnceAsync();

        Assert.Equal(1, committed);

        var read = await _flagService.GetCommittedAsync(_envId, key);
        Assert.True(read.IsEnabled);
        Assert.Equal(v, read.CommittedVersion);

        Assert.Single(producer.Published);
    }

    [DockerFact]
    public async Task Skips_When_PendingVersion_NotNewerThanCommitted()
    {
        // committed v5, pending staged at v2 (stale) -> must be skipped on monotonicity (#34)
        const string key = "stale-pending";
        var committed = CreateFlag(key, isEnabled: true);
        committed.CommittedVersion = 5;
        await _flagService.AddOneAsync(committed);

        var pendingValue = CreateFlag(key, isEnabled: false);
        pendingValue.Id = committed.Id;
        await _flagService.SetPendingAsync(_envId, key, pendingValue, version: 2);

        var now = DateTimeOffset.UtcNow;
        await UpsertLeaseAsync(DcA, now.AddMinutes(5));
        await UpsertLeaseAsync(DcB, now.AddMinutes(5));

        // even if both DCs have it staged, the stale version must not be committed
        await _dcaCache.StageFlagAsync(pendingValue, 2);
        await _dcbCache.StageFlagAsync(pendingValue, 2);

        var producer = new SpyMessageProducer();
        var sut = CreateSut(producer);

        var committed2 = await sut.RunOnceAsync();

        Assert.Equal(0, committed2);
        Assert.Empty(producer.Published);

        var read = await _flagService.GetCommittedAsync(_envId, key);
        Assert.True(read.IsEnabled);
        Assert.Equal(5, read.CommittedVersion);
    }

    [DockerFact]
    public async Task NoCommit_When_NoLiveDcs()
    {
        const string key = "no-live-dcs";
        var (_, _, v) = await SeedCommittedV1PendingV2(key);
        var flag = await _flagService.GetAsync(_envId, key);

        // both DCs have it staged, but NO live leases exist
        await _dcaCache.StageFlagAsync(flag.Pending!.Value, v);
        await _dcbCache.StageFlagAsync(flag.Pending!.Value, v);

        var producer = new SpyMessageProducer();
        var sut = CreateSut(producer);

        var committed = await sut.RunOnceAsync();

        Assert.Equal(0, committed);
        Assert.Empty(producer.Published);

        var read = await _flagService.GetCommittedAsync(_envId, key);
        Assert.False(read.IsEnabled);
        Assert.Equal(1, read.CommittedVersion);
    }

    [DockerFact]
    public async Task SecondTick_IsIdempotent_AfterCommit()
    {
        const string key = "idempotent";
        var (_, _, v) = await SeedCommittedV1PendingV2(key);
        var flag = await _flagService.GetAsync(_envId, key);

        var now = DateTimeOffset.UtcNow;
        await UpsertLeaseAsync(DcA, now.AddMinutes(5));
        await UpsertLeaseAsync(DcB, now.AddMinutes(5));

        await _dcaCache.StageFlagAsync(flag.Pending!.Value, v);
        await _dcbCache.StageFlagAsync(flag.Pending!.Value, v);

        var producer = new SpyMessageProducer();
        var sut = CreateSut(producer);

        var first = await sut.RunOnceAsync();
        var second = await sut.RunOnceAsync();

        Assert.Equal(1, first);
        Assert.Equal(0, second); // nothing left pending -> no-op
        Assert.Single(producer.Published);
    }

    // ----- #71b leader gating -----

    [DockerFact]
    public async Task Coordinator_NotLeader_SkipsTick()
    {
        // Seed a fully committable pending change (both live DCs have it staged) -> if leadership
        // were NOT gating, this tick would commit. A not-leader SUT must skip entirely instead.
        const string key = "not-leader-skip";
        var (_, _, v) = await SeedCommittedV1PendingV2(key);
        var flag = await _flagService.GetAsync(_envId, key);

        var now = DateTimeOffset.UtcNow;
        await UpsertLeaseAsync(DcA, now.AddMinutes(5));
        await UpsertLeaseAsync(DcB, now.AddMinutes(5));

        await _dcaCache.StageFlagAsync(flag.Pending!.Value, v);
        await _dcbCache.StageFlagAsync(flag.Pending!.Value, v);

        var producer = new SpyMessageProducer();
        var sut = CreateSut(producer, isLeader: false);

        using var commits = new CounterCollector(CommitCoordinatorWorker.CommitsCounterName);

        var committed = await sut.RunOnceAsync();

        Assert.Equal(0, committed);
        Assert.Empty(producer.Published);
        Assert.Empty(commits.Measurements);

        // pending is untouched: still v2, not promoted
        var read = await _flagService.GetCommittedAsync(_envId, key);
        Assert.False(read.IsEnabled);
        Assert.Equal(1, read.CommittedVersion);

        var raw = await _flagService.GetAsync(_envId, key);
        Assert.NotNull(raw.Pending);
        Assert.Equal(v, raw.Pending!.Version);
    }

    // ----- eviction observability (#16) -----

    [DockerFact]
    public async Task EvictedCommit_Logs_And_IncrementsCounter_NamingEvictedDc()
    {
        // dc-a live + staged; dc-b is CONFIGURED (composite probes it) but its lease has EXPIRED, so
        // it is evicted from the live set. The commit proceeds on the live set, and the eviction
        // must be recorded (warning log naming dc-b + counter increment tagged dc_id=dc-b).
        const string key = "evicted-commit-observed";
        var (_, _, v) = await SeedCommittedV1PendingV2(key);
        var flag = await _flagService.GetAsync(_envId, key);

        var now = DateTimeOffset.UtcNow;
        await UpsertLeaseAsync(DcA, now.AddMinutes(5));   // dc-a live
        await UpsertLeaseAsync(DcB, now.AddMinutes(-5));  // dc-b lease EXPIRED -> evicted

        await _dcaCache.StageFlagAsync(flag.Pending!.Value, v);

        var logger = new CapturingLogger();
        var producer = new SpyMessageProducer();
        var sut = CreateSut(producer, logger);

        using var counter = new CounterCollector(CommitCoordinatorWorker.EvictedCommitCounterName);

        var committed = await sut.RunOnceAsync();

        // commit decision unchanged: it still committed on the live set
        Assert.Equal(1, committed);

        // metric: exactly one increment, tagged with the evicted dc_id
        var measurement = Assert.Single(counter.Measurements);
        Assert.Equal(1, measurement.Value);
        Assert.Equal(DcB, measurement.Tags["dc_id"]);

        // log: a warning naming the flag, the version, and the evicted DC
        var warning = Assert.Single(logger.Warnings);
        Assert.Contains(flag.Id.ToString(), warning);
        Assert.Contains(v.ToString(), warning);
        Assert.Contains(DcB, warning);
    }

    [DockerFact]
    public async Task NoEviction_When_AllConfiguredDcsLive_DoesNotLogOrIncrement()
    {
        // both configured DCs are live + staged -> no eviction; no extra warning, no counter.
        const string key = "no-eviction-observed";
        var (_, _, v) = await SeedCommittedV1PendingV2(key);
        var flag = await _flagService.GetAsync(_envId, key);

        var now = DateTimeOffset.UtcNow;
        await UpsertLeaseAsync(DcA, now.AddMinutes(5));
        await UpsertLeaseAsync(DcB, now.AddMinutes(5));

        await _dcaCache.StageFlagAsync(flag.Pending!.Value, v);
        await _dcbCache.StageFlagAsync(flag.Pending!.Value, v);

        var logger = new CapturingLogger();
        var producer = new SpyMessageProducer();
        var sut = CreateSut(producer, logger);

        using var counter = new CounterCollector(CommitCoordinatorWorker.EvictedCommitCounterName);

        var committed = await sut.RunOnceAsync();

        Assert.Equal(1, committed);
        Assert.Empty(counter.Measurements);
        Assert.Empty(logger.Warnings);
    }

    // ----- test doubles -----

    /// <summary>
    /// Captures emitted measurements for a single named counter on the control-plane consistency
    /// meter via <see cref="MeterListener"/>, so the test can assert the eviction counter fired
    /// with the expected value + tags.
    /// </summary>
    private sealed class CounterCollector : IDisposable
    {
        private readonly MeterListener _listener;

        public List<(long Value, IReadOnlyDictionary<string, object?> Tags)> Measurements { get; } = new();

        public CounterCollector(string instrumentName)
        {
            _listener = new MeterListener
            {
                InstrumentPublished = (instrument, listener) =>
                {
                    if (instrument.Meter.Name == CommitCoordinatorWorker.MeterName
                        && instrument.Name == instrumentName)
                    {
                        listener.EnableMeasurementEvents(instrument);
                    }
                }
            };

            _listener.SetMeasurementEventCallback<long>((_, measurement, tags, _) =>
            {
                var dict = new Dictionary<string, object?>();
                foreach (var tag in tags)
                {
                    dict[tag.Key] = tag.Value;
                }

                Measurements.Add((measurement, dict));
            });

            _listener.Start();
        }

        public void Dispose() => _listener.Dispose();
    }

    /// <summary>Captures warning-level log messages (rendered) for assertion.</summary>
    private sealed class CapturingLogger : ILogger<CommitCoordinatorWorker>
    {
        public List<string> Warnings { get; } = new();

        public IDisposable BeginScope<TState>(TState state) where TState : notnull => NullScope.Instance;

        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(
            LogLevel logLevel,
            EventId eventId,
            TState state,
            Exception? exception,
            Func<TState, Exception?, string> formatter)
        {
            if (logLevel == LogLevel.Warning)
            {
                Warnings.Add(formatter(state, exception));
            }
        }

        private sealed class NullScope : IDisposable
        {
            public static readonly NullScope Instance = new();
            public void Dispose() { }
        }
    }

    private sealed class SpyMessageProducer : IMessageProducer
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
}

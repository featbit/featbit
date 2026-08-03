using Api.IntegrationTests.Stubs;
using Api.Application.ControlPlane;
using Api.Infrastructure.Caches;
using Api.IntegrationTests.Fixtures;
using Application.Caches;
using Application.ControlPlane;
using Application.Segments;
using Application.Services;
using Domain.ControlPlane;
using Domain.FeatureFlags;
using Domain.Messages;
using Domain.Segments;
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
/// F1 (#24) consistency-metrics acceptance tests for <see cref="CommitCoordinatorWorker"/>. Exercises
/// the three F1 instruments (all on the existing <see cref="CommitCoordinatorWorker.MeterName"/>
/// meter) end-to-end against real infrastructure, reusing the C3b-2 coordinator harness (real Mongo +
/// real Redis whose two logical DB indexes simulate two DCs):
///   1. <see cref="CommitCoordinatorWorker.CommitsCounterName"/> — once per committed flag/segment,
///      tagged <c>resource_type</c>.
///   2. <see cref="CommitCoordinatorWorker.TimeToCommitHistogramName"/> — stage->commit latency in
///      ms recorded at each commit, tagged <c>resource_type</c>.
///   3. <see cref="CommitCoordinatorWorker.PendingBacklogGaugeName"/> — observable gauge reporting the
///      currently-pending count per <c>resource_type</c>, updated at the end of each tick.
///
/// Uses shared Testcontainers MongoDB and Redis fixtures; Redis logical DB indexes simulate DCs.
/// </summary>
[Collection(MongoRedisCollection.Name)]
public sealed class ConsistencyMetricsTests : IntegrationTestBase, IAsyncLifetime
{
    private readonly MongoDbFixture _mongoFixture;
    private readonly RedisFixture _redisFixture;

    private const string DcA = "dc-a";
    private const string DcB = "dc-b";

    private readonly string _dbName = $"featbit_f1_test_{Guid.NewGuid():N}";
    private readonly Guid _envId = Guid.NewGuid();

    private MongoDbClient _mongoDb = null!;
    private FeatureFlagService _flagService = null!;
    private SegmentService _segmentService = null!;
    private MongoLeaseStore _leaseStore = null!;

    private ConnectionMultiplexer _mux = null!;
    private RedisCacheService _dcaCache = null!; // db 0
    private RedisCacheService _dcbCache = null!; // db 1
    private CompositeRedisCacheService _composite = null!;

    public ConsistencyMetricsTests(MongoDbFixture mongoFixture, RedisFixture redisFixture)
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

    /// <summary>
    /// Seeds a committed flag (v1, disabled) with a staged pending change. The pending value's
    /// <c>UpdatedAt</c> is set to <paramref name="updatedAt"/> so the histogram can assert a known
    /// stage->commit latency (now - UpdatedAt). Returns the pending version.
    /// </summary>
    private async Task<long> SeedFlagCommittedV1PendingV2(string key, DateTime updatedAt)
    {
        var committed = CreateFlag(key, isEnabled: false);
        committed.CommittedVersion = 1;
        await _flagService.AddOneAsync(committed);

        var pendingValue = CreateFlag(key, isEnabled: true);
        pendingValue.Id = committed.Id;
        pendingValue.UpdatedAt = updatedAt;
        const long pendingVersion = 2;
        await _flagService.SetPendingAsync(_envId, key, pendingValue, pendingVersion);

        return pendingVersion;
    }

    private Segment CreateSegment(string key, params string[] included)
    {
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
            description: string.Empty);
    }

    /// <summary>
    /// Seeds a committed segment (v1) with a staged pending change. The pending value's
    /// <c>UpdatedAt</c> is set to <paramref name="updatedAt"/> (its unix-ms == pending version, matching
    /// how S2 stages). Returns the pending version.
    /// </summary>
    private async Task<long> SeedSegmentCommittedV1Pending(string key, DateTime updatedAt)
    {
        var committed = CreateSegment(key, "alice");
        committed.CommittedVersion = 1;
        await _segmentService.AddOneAsync(committed);

        var pendingVersion = new DateTimeOffset(updatedAt).ToUnixTimeMilliseconds();

        var pendingValue = CreateSegment(key, "bob");
        pendingValue.Id = committed.Id;
        pendingValue.UpdatedAt = updatedAt;
        await _segmentService.SetPendingAsync(committed.Id, pendingValue, pendingVersion);

        return pendingVersion;
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
    /// #84: upserts a lease carrying <see cref="DcLease.AppliedWatermarks"/> so the applied-watermark
    /// -lag gauge tests can seed per-DC/per-env watermarks directly via the lease store.
    /// </summary>
    private async Task UpsertLeaseAsync(
        string dcId,
        DateTimeOffset expiresAt,
        Dictionary<Guid, long> appliedWatermarks)
    {
        await _leaseStore.UpsertLeaseAsync(new DcLease
        {
            DcId = dcId,
            Region = dcId,
            LastHeartbeatAt = DateTimeOffset.UtcNow,
            LeaseExpiresAt = expiresAt,
            AppliedWatermarks = appliedWatermarks
        });
    }

    private CommitCoordinatorWorker CreateSut()
    {
        var services = new ServiceCollection();
        services.AddTransient<IFeatureFlagService>(_ => _flagService);
        services.AddTransient<ISegmentService>(_ => _segmentService);
        services.AddTransient<ILeaseStore>(_ => _leaseStore);
        services.AddTransient<ISegmentMessageService>(_ => new NoopSegmentMessageService());
        services.AddTransient<IFeatureFlagAppService>(_ => new NoopFeatureFlagAppService());
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
            new SpyMessageProducer(),
            new FakeLeaderElection(isLeader: true),
            configuration,
            NullLogger<CommitCoordinatorWorker>.Instance);
    }

    // ----- acceptance cases -----

    [DockerFact]
    public async Task Commit_Increments_CommitsCounter_And_Records_TimeToCommit_PerResourceType()
    {
        // one flag + one segment, both staged on both live DCs -> both commit this tick.
        var flagUpdatedAt = DateTime.UtcNow.AddSeconds(-3);
        var flagVersion = await SeedFlagCommittedV1PendingV2("f1-flag", flagUpdatedAt);
        var flag = await _flagService.GetAsync(_envId, "f1-flag");

        var segUpdatedAt = DateTime.UtcNow.AddSeconds(-2);
        var segVersion = await SeedSegmentCommittedV1Pending("f1-seg", segUpdatedAt);
        var segment = (await _segmentService.GetPendingAsync()).First(s => s.Key == "f1-seg");

        var now = DateTimeOffset.UtcNow;
        await UpsertLeaseAsync(DcA, now.AddMinutes(5));
        await UpsertLeaseAsync(DcB, now.AddMinutes(5));

        await _dcaCache.StageFlagAsync(flag.Pending!.Value, flagVersion);
        await _dcbCache.StageFlagAsync(flag.Pending!.Value, flagVersion);
        await _dcaCache.StageSegmentAsync(segment.Pending!.Value, segVersion);
        await _dcbCache.StageSegmentAsync(segment.Pending!.Value, segVersion);

        using var commits = new CounterCollector(CommitCoordinatorWorker.CommitsCounterName);
        using var histogram = new HistogramCollector(CommitCoordinatorWorker.TimeToCommitHistogramName);

        var sut = CreateSut();
        var committed = await sut.RunOnceAsync();

        Assert.Equal(2, committed);

        // commits counter: exactly one flag + one segment increment, tagged resource_type
        Assert.Equal(2, commits.Measurements.Count);
        var flagCommit = Assert.Single(commits.Measurements, m => (string?)m.Tags["resource_type"] == "flag");
        Assert.Equal(1, flagCommit.Value);
        var segCommit = Assert.Single(commits.Measurements, m => (string?)m.Tags["resource_type"] == "segment");
        Assert.Equal(1, segCommit.Value);

        // env_id tag present on the flag commit (cheap to add from the pending flag record)
        Assert.Equal(_envId.ToString(), (string?)flagCommit.Tags["env_id"]);

        // time-to-commit histogram: one measurement per resource_type, each a positive ms latency
        Assert.Equal(2, histogram.Measurements.Count);
        var flagLatency = Assert.Single(histogram.Measurements, m => (string?)m.Tags["resource_type"] == "flag");
        var segLatency = Assert.Single(histogram.Measurements, m => (string?)m.Tags["resource_type"] == "segment");
        // UpdatedAt was ~3s/~2s ago, so latency should be at least ~1s of ms (sanity, not flaky-tight)
        Assert.True(flagLatency.Value >= 1000, $"flag latency was {flagLatency.Value}");
        Assert.True(segLatency.Value >= 1000, $"segment latency was {segLatency.Value}");
    }

    [DockerFact]
    public async Task PendingBacklog_Gauge_Reports_RemainingPendingCounts_PerResourceType()
    {
        // 2 pending flags + 1 pending segment, but NOTHING staged -> nothing commits, so after the
        // tick the backlog gauge reports the full pending counts (flag=2, segment=1).
        await SeedFlagCommittedV1PendingV2("f1-backlog-flag-a", DateTime.UtcNow);
        await SeedFlagCommittedV1PendingV2("f1-backlog-flag-b", DateTime.UtcNow);
        await SeedSegmentCommittedV1Pending("f1-backlog-seg", DateTime.UtcNow.AddSeconds(-1));

        var now = DateTimeOffset.UtcNow;
        await UpsertLeaseAsync(DcA, now.AddMinutes(5));
        await UpsertLeaseAsync(DcB, now.AddMinutes(5));

        var sut = CreateSut();
        var committed = await sut.RunOnceAsync(); // nothing staged -> 0 committed
        Assert.Equal(0, committed);

        // observable gauge is read on demand: force a flush and capture the reported values
        var backlog = ReadBacklogGauge();
        Assert.Equal(2, backlog["flag"]);
        Assert.Equal(1, backlog["segment"]);
    }

    [DockerFact]
    public async Task PendingBacklog_Gauge_Reports_Zero_AfterBacklogDrained()
    {
        // one flag + one segment staged on both DCs -> both commit on tick 1. A second tick finds an
        // empty pending set, so the backlog gauge must report 0 for both resource types.
        var flagVersion = await SeedFlagCommittedV1PendingV2("f1-drain-flag", DateTime.UtcNow.AddSeconds(-1));
        var flag = await _flagService.GetAsync(_envId, "f1-drain-flag");

        var segVersion = await SeedSegmentCommittedV1Pending("f1-drain-seg", DateTime.UtcNow.AddSeconds(-1));
        var segment = (await _segmentService.GetPendingAsync()).First(s => s.Key == "f1-drain-seg");

        var now = DateTimeOffset.UtcNow;
        await UpsertLeaseAsync(DcA, now.AddMinutes(5));
        await UpsertLeaseAsync(DcB, now.AddMinutes(5));

        await _dcaCache.StageFlagAsync(flag.Pending!.Value, flagVersion);
        await _dcbCache.StageFlagAsync(flag.Pending!.Value, flagVersion);
        await _dcaCache.StageSegmentAsync(segment.Pending!.Value, segVersion);
        await _dcbCache.StageSegmentAsync(segment.Pending!.Value, segVersion);

        var sut = CreateSut();
        Assert.Equal(2, await sut.RunOnceAsync()); // commit both
        Assert.Equal(0, await sut.RunOnceAsync()); // nothing left pending

        var backlog = ReadBacklogGauge();
        Assert.Equal(0, backlog["flag"]);
        Assert.Equal(0, backlog["segment"]);
    }

    /// <summary>
    /// Force a single read of the observable backlog gauge and return the latest value per
    /// <c>resource_type</c>. Uses a short-lived <see cref="MeterListener"/> with
    /// <c>RecordObservableInstruments</c> to pull the current measurements on demand.
    /// </summary>
    private static Dictionary<string, long> ReadBacklogGauge()
    {
        var values = new Dictionary<string, long>();

        using var listener = new MeterListener
        {
            InstrumentPublished = (instrument, l) =>
            {
                if (instrument.Meter.Name == CommitCoordinatorWorker.MeterName
                    && instrument.Name == CommitCoordinatorWorker.PendingBacklogGaugeName)
                {
                    l.EnableMeasurementEvents(instrument);
                }
            }
        };

        listener.SetMeasurementEventCallback<long>((_, measurement, tags, _) =>
        {
            foreach (var tag in tags)
            {
                if (tag.Key == "resource_type" && tag.Value is string rt)
                {
                    values[rt] = measurement;
                }
            }
        });

        listener.Start();
        listener.RecordObservableInstruments();

        return values;
    }

    /// <summary>
    /// #84: force a single read of the observable applied-watermark-lag gauge and return every
    /// (dc_id, env_id, lag_ms) measurement. Mirrors <see cref="ReadBacklogGauge"/>'s
    /// on-demand-read pattern.
    /// </summary>
    private static List<(string DcId, Guid EnvId, long LagMs)> ReadAppliedWatermarkLagGauge()
    {
        var values = new List<(string DcId, Guid EnvId, long LagMs)>();

        using var listener = new MeterListener
        {
            InstrumentPublished = (instrument, l) =>
            {
                if (instrument.Meter.Name == CommitCoordinatorWorker.MeterName
                    && instrument.Name == CommitCoordinatorWorker.AppliedWatermarkLagGaugeName)
                {
                    l.EnableMeasurementEvents(instrument);
                }
            }
        };

        listener.SetMeasurementEventCallback<long>((_, measurement, tags, _) =>
        {
            string? dcId = null;
            string? envId = null;
            foreach (var tag in tags)
            {
                if (tag.Key == "dc_id" && tag.Value is string dc)
                {
                    dcId = dc;
                }
                else if (tag.Key == "env_id" && tag.Value is string env)
                {
                    envId = env;
                }
            }

            if (dcId != null && envId != null)
            {
                values.Add((dcId, Guid.Parse(envId), measurement));
            }
        });

        listener.Start();
        listener.RecordObservableInstruments();

        return values;
    }

    // ----- #84 applied-watermark-lag gauge acceptance cases -----

    [DockerFact]
    public async Task Lag_Reports_Zero_For_Frontier_Dc_And_Delta_For_Straggler()
    {
        // DC A is the frontier (higher watermark); DC B lags behind by a known delta. No pending
        // flags/segments are seeded — the lag gauge is refreshed every tick independent of that.
        var envId = Guid.NewGuid();
        const long frontierWatermark = 10_000;
        const long delta = 2_500;
        const long stragglerWatermark = frontierWatermark - delta;

        var now = DateTimeOffset.UtcNow;
        await UpsertLeaseAsync(DcA, now.AddMinutes(5), new Dictionary<Guid, long> { [envId] = frontierWatermark });
        await UpsertLeaseAsync(DcB, now.AddMinutes(5), new Dictionary<Guid, long> { [envId] = stragglerWatermark });

        var sut = CreateSut();
        await sut.RunOnceAsync();

        var lag = ReadAppliedWatermarkLagGauge();

        Assert.Equal(2, lag.Count);
        var frontier = Assert.Single(lag, m => m.DcId == DcA && m.EnvId == envId);
        Assert.Equal(0, frontier.LagMs);
        var straggler = Assert.Single(lag, m => m.DcId == DcB && m.EnvId == envId);
        Assert.Equal(delta, straggler.LagMs);
    }

    [DockerFact]
    public async Task Lag_Omits_Envs_A_Dc_Does_Not_Report()
    {
        // DC A reports {e1, e2}; DC B only reports {e1} -> no (DcB, e2) measurement should ever be
        // emitted (inventing lag = frontier - 0 for an env a DC doesn't serve would be misleading).
        var e1 = Guid.NewGuid();
        var e2 = Guid.NewGuid();

        var now = DateTimeOffset.UtcNow;
        await UpsertLeaseAsync(
            DcA,
            now.AddMinutes(5),
            new Dictionary<Guid, long> { [e1] = 5_000, [e2] = 8_000 });
        await UpsertLeaseAsync(
            DcB,
            now.AddMinutes(5),
            new Dictionary<Guid, long> { [e1] = 4_000 });

        var sut = CreateSut();
        await sut.RunOnceAsync();

        var lag = ReadAppliedWatermarkLagGauge();

        Assert.Equal(3, lag.Count); // (DcA, e1), (DcA, e2), (DcB, e1) — no (DcB, e2)
        Assert.DoesNotContain(lag, m => m.DcId == DcB && m.EnvId == e2);

        var dcAe1 = Assert.Single(lag, m => m.DcId == DcA && m.EnvId == e1);
        Assert.Equal(0, dcAe1.LagMs); // DcA is the frontier for e1 (only reporter, trivially max)
        var dcAe2 = Assert.Single(lag, m => m.DcId == DcA && m.EnvId == e2);
        Assert.Equal(0, dcAe2.LagMs); // DcA is the only (and thus frontier) reporter for e2
        var dcBe1 = Assert.Single(lag, m => m.DcId == DcB && m.EnvId == e1);
        Assert.Equal(1_000, dcBe1.LagMs); // frontier(e1) = 5000 (DcA) - 4000 (DcB) = 1000
    }

    [DockerFact]
    public async Task No_Watermarks_No_Measurements()
    {
        // Two live DCs, neither reporting any watermark -> the gauge must emit nothing.
        var now = DateTimeOffset.UtcNow;
        await UpsertLeaseAsync(DcA, now.AddMinutes(5));
        await UpsertLeaseAsync(DcB, now.AddMinutes(5));

        var sut = CreateSut();
        await sut.RunOnceAsync();

        var lag = ReadAppliedWatermarkLagGauge();

        Assert.Empty(lag);
    }

    // ----- test doubles -----

    private sealed class NoopSegmentMessageService : ISegmentMessageService
    {
        public ValueTask<ICollection<FlagReference>> GetAffectedFlagsAsync(Guid envId, OnSegmentChange notification) =>
            ValueTask.FromResult<ICollection<FlagReference>>([]);

        public Task PublishChangeMessage(Guid envId, ICollection<FlagReference> affectedFlags, Segment segment) =>
            Task.CompletedTask;
    }

    private sealed class NoopFeatureFlagAppService : IFeatureFlagAppService
    {
        public Task ApplyDraftAsync(Guid draftId, string operation, Guid operatorId) => Task.CompletedTask;

        public Task OnSegmentUpdatedAsync(Segment segment, Guid operatorId, ICollection<FlagReference> flagReferences) =>
            Task.CompletedTask;
    }

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

    private sealed class HistogramCollector : IDisposable
    {
        private readonly MeterListener _listener;

        public List<(double Value, IReadOnlyDictionary<string, object?> Tags)> Measurements { get; } = new();

        public HistogramCollector(string instrumentName)
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

            _listener.SetMeasurementEventCallback<double>((_, measurement, tags, _) =>
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

    private sealed class SpyMessageProducer : IMessageProducer
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

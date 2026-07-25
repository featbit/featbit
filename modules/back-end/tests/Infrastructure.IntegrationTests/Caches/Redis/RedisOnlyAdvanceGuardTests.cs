using Domain.FeatureFlags;
using Domain.Segments;
using Infrastructure.Caches.Redis;
using StackExchange.Redis;
using Infrastructure.IntegrationTests.Fixtures;

namespace Infrastructure.IntegrationTests.Caches.Redis;

/// <summary>
/// Integration tests for the #89 only-advance guard: a DC cache backfill snapshots the committed
/// values once and then awaits per-item writes, so a NEWER commit can land on the same DC before the
/// backfill's write for an OLDER snapshot does. Without a guard, that stale write would revert the
/// fresher committed pointer/value. These tests exercise the guard directly against a real Redis:
///   - CommitFlagAsync / CommitSegmentAsync: a stale ts must not move the committed pointer or the
///     sorted-set index score; a newer ts must still advance both.
///   - UpsertFlagIfNewerAsync / UpsertSegmentIfNewerAsync: the targeted BestEffort legacy upsert used
///     by the backfiller, guarded by the index score as the version register.
///
/// Runs against a throwaway Redis provisioned by <see cref="RedisFixture"/> (Testcontainers);
/// no manually-started container is required. When Docker is unavailable each test is skipped
/// via <c>[DockerFact]</c> rather than failing.
/// </summary>
[Collection(RedisCollection.Name)]
public class RedisOnlyAdvanceGuardTests : IntegrationTestBase, IAsyncLifetime
{
    private readonly RedisFixture _fixture;

    public RedisOnlyAdvanceGuardTests(RedisFixture fixture)
    {
        _fixture = fixture;
    }

    private ConnectionMultiplexer? _mux;
    private RedisCacheService? _sut;

    public async Task InitializeAsync()
    {
        if (!DockerAvailability.IsAvailable)
        {
            return;
        }

        var options = ConfigurationOptions.Parse(_fixture.ConnectionString);
        options.AllowAdmin = true;

        _mux = await ConnectionMultiplexer.ConnectAsync(options);

        var server = _mux.GetServer(_mux.GetEndPoints().Single());
        await server.FlushDatabaseAsync();

        _sut = new RedisCacheService(new TestRedisClient(_mux));
    }

    public Task DisposeAsync()
    {
        _mux?.Dispose();
        return Task.CompletedTask;
    }

    // ----- CommitFlagAsync: pointer + index only-advance -----

    [DockerFact]
    public async Task CommitFlagAsync_StaleTs_DoesNotRevertPointerOrIndex()
    {
        var sut = _sut!;
        var db = _mux!.GetDatabase();

        var envId = Guid.NewGuid();
        var flagId = Guid.NewGuid();
        var flagIdString = flagId.ToString();

        var committedKey = RedisKeys.FlagCommittedPointer(flagId);
        var indexKey = RedisKeys.FlagIndex(envId);

        try
        {
            // A normal commit lands ts2 first (simulates the racing normal coordinator commit that
            // gets ahead of a backfill still holding an older snapshot).
            var ts2 = 2_000L;
            var acceptedTs2 = await sut.CommitFlagAsync(envId, flagIdString, ts2);
            Assert.True(acceptedTs2, "#105: a genuinely advancing commit must be reported as accepted");

            Assert.Equal(ts2.ToString(), (string?)await db.StringGetAsync(committedKey));
            Assert.Equal(ts2, await db.SortedSetScoreAsync(indexKey, flagIdString));

            // The backfill's delayed write for its stale ts1 snapshot arrives AFTER: must be a no-op.
            var ts1 = 1_000L;
            var acceptedTs1 = await sut.CommitFlagAsync(envId, flagIdString, ts1);

            // ACCEPTANCE: pointer + index must still read ts2, NOT reverted to ts1.
            Assert.Equal(ts2.ToString(), (string?)await db.StringGetAsync(committedKey));
            Assert.Equal(ts2, await db.SortedSetScoreAsync(indexKey, flagIdString));

            // #105: the guard-rejected stale commit must report false, not true.
            Assert.False(acceptedTs1, "#105: a guard-rejected stale commit must be reported as NOT accepted");
        }
        finally
        {
            await db.KeyDeleteAsync(committedKey);
            await db.SortedSetRemoveAsync(indexKey, flagIdString);
        }
    }

    [DockerFact]
    public async Task CommitFlagAsync_NewerTs_StillAdvancesPointerAndIndex()
    {
        var sut = _sut!;
        var db = _mux!.GetDatabase();

        var envId = Guid.NewGuid();
        var flagId = Guid.NewGuid();
        var flagIdString = flagId.ToString();

        var committedKey = RedisKeys.FlagCommittedPointer(flagId);
        var indexKey = RedisKeys.FlagIndex(envId);

        try
        {
            var ts1 = 1_000L;
            Assert.True(await sut.CommitFlagAsync(envId, flagIdString, ts1));
            Assert.Equal(ts1.ToString(), (string?)await db.StringGetAsync(committedKey));

            var ts2 = 2_000L;
            var accepted = await sut.CommitFlagAsync(envId, flagIdString, ts2);

            // ACCEPTANCE: a genuinely newer ts still advances both pointer and index (the guard
            // must not be a no-op for the normal, monotonically-increasing path).
            Assert.Equal(ts2.ToString(), (string?)await db.StringGetAsync(committedKey));
            Assert.Equal(ts2, await db.SortedSetScoreAsync(indexKey, flagIdString));
            Assert.True(accepted, "#105: a genuinely advancing commit must be reported as accepted");
        }
        finally
        {
            await db.KeyDeleteAsync(committedKey);
            await db.SortedSetRemoveAsync(indexKey, flagIdString);
        }
    }

    // ----- CommitSegmentAsync: pointer + index only-advance (segment counterpart) -----

    [DockerFact]
    public async Task CommitSegmentAsync_StaleTs_DoesNotRevertPointerOrIndex()
    {
        var sut = _sut!;
        var db = _mux!.GetDatabase();

        var envId = Guid.NewGuid();
        var segmentId = Guid.NewGuid();
        var segmentIdString = segmentId.ToString();
        var envIds = new[] { envId };

        var committedKey = RedisKeys.SegmentCommittedPointer(segmentId);
        var indexKey = RedisKeys.SegmentIndex(envId);

        try
        {
            var ts2 = 2_000L;
            Assert.True(await sut.CommitSegmentAsync(envIds, segmentIdString, ts2));
            Assert.Equal(ts2.ToString(), (string?)await db.StringGetAsync(committedKey));

            var ts1 = 1_000L;
            var acceptedTs1 = await sut.CommitSegmentAsync(envIds, segmentIdString, ts1);

            Assert.Equal(ts2.ToString(), (string?)await db.StringGetAsync(committedKey));
            Assert.Equal(ts2, await db.SortedSetScoreAsync(indexKey, segmentIdString));
            Assert.False(acceptedTs1, "#105: a guard-rejected stale commit must be reported as NOT accepted");
        }
        finally
        {
            await db.KeyDeleteAsync(committedKey);
            await db.SortedSetRemoveAsync(indexKey, segmentIdString);
        }
    }

    [DockerFact]
    public async Task CommitSegmentAsync_NewerTs_StillAdvancesPointerAndIndex()
    {
        var sut = _sut!;
        var db = _mux!.GetDatabase();

        var envId = Guid.NewGuid();
        var segmentId = Guid.NewGuid();
        var segmentIdString = segmentId.ToString();
        var envIds = new[] { envId };

        var committedKey = RedisKeys.SegmentCommittedPointer(segmentId);
        var indexKey = RedisKeys.SegmentIndex(envId);

        try
        {
            var ts1 = 1_000L;
            Assert.True(await sut.CommitSegmentAsync(envIds, segmentIdString, ts1));

            var ts2 = 2_000L;
            var accepted = await sut.CommitSegmentAsync(envIds, segmentIdString, ts2);

            Assert.Equal(ts2.ToString(), (string?)await db.StringGetAsync(committedKey));
            Assert.Equal(ts2, await db.SortedSetScoreAsync(indexKey, segmentIdString));
            Assert.True(accepted, "#105: a genuinely advancing commit must be reported as accepted");
        }
        finally
        {
            await db.KeyDeleteAsync(committedKey);
            await db.SortedSetRemoveAsync(indexKey, segmentIdString);
        }
    }

    // ----- UpsertFlagIfNewerAsync: targeted BestEffort legacy upsert guarded by index score -----

    [DockerFact]
    public async Task UpsertFlagIfNewerAsync_StaleValue_DoesNotRevertLegacyKeyOrIndex()
    {
        var sut = _sut!;
        var db = _mux!.GetDatabase();

        var envId = Guid.NewGuid();
        var flagId = Guid.NewGuid();
        var flagIdString = flagId.ToString();

        var valueKey = RedisKeys.Flag(flagId);
        var indexKey = RedisKeys.FlagIndex(envId);

        try
        {
            // A normal (unguarded) upsert lands the fresher value first — simulates a normal write
            // racing ahead of a backfill's stale snapshot.
            var ts2 = 2_000L;
            var flagAtTs2 = NewFlag(envId, flagId, isEnabled: true, ts2);
            await sut.UpsertFlagAsync(flagAtTs2);
            Assert.Equal(ts2, await db.SortedSetScoreAsync(indexKey, flagIdString));

            // The backfiller's targeted, guarded write for its stale ts1 snapshot must be a no-op.
            var ts1 = 1_000L;
            var flagAtTs1 = NewFlag(envId, flagId, isEnabled: false, ts1);
            var accepted = await sut.UpsertFlagIfNewerAsync(flagAtTs1);

            // ACCEPTANCE: the legacy value key must still read the ts2 (enabled) content, and the
            // index score must still be ts2 — the stale ts1 write must not have landed.
            var storedJson = (string?)await db.StringGetAsync(valueKey);
            Assert.Contains("\"isEnabled\":true", storedJson);
            Assert.Equal(ts2, await db.SortedSetScoreAsync(indexKey, flagIdString));
            Assert.False(accepted, "#105: a guard-rejected stale upsert must be reported as NOT accepted");
        }
        finally
        {
            await db.KeyDeleteAsync(valueKey);
            await db.SortedSetRemoveAsync(indexKey, flagIdString);
        }
    }

    [DockerFact]
    public async Task UpsertFlagIfNewerAsync_NewerValue_StillAdvancesLegacyKeyAndIndex()
    {
        var sut = _sut!;
        var db = _mux!.GetDatabase();

        var envId = Guid.NewGuid();
        var flagId = Guid.NewGuid();
        var flagIdString = flagId.ToString();

        var valueKey = RedisKeys.Flag(flagId);
        var indexKey = RedisKeys.FlagIndex(envId);

        try
        {
            var ts1 = 1_000L;
            var flagAtTs1 = NewFlag(envId, flagId, isEnabled: false, ts1);
            Assert.True(await sut.UpsertFlagIfNewerAsync(flagAtTs1));

            var ts2 = 2_000L;
            var flagAtTs2 = NewFlag(envId, flagId, isEnabled: true, ts2);
            var accepted = await sut.UpsertFlagIfNewerAsync(flagAtTs2);

            var storedJson = (string?)await db.StringGetAsync(valueKey);
            Assert.Contains("\"isEnabled\":true", storedJson);
            Assert.Equal(ts2, await db.SortedSetScoreAsync(indexKey, flagIdString));
            Assert.True(accepted, "#105: a genuinely advancing upsert must be reported as accepted");
        }
        finally
        {
            await db.KeyDeleteAsync(valueKey);
            await db.SortedSetRemoveAsync(indexKey, flagIdString);
        }
    }

    // ----- UpsertSegmentIfNewerAsync: targeted BestEffort legacy upsert (segment counterpart) -----

    [DockerFact]
    public async Task UpsertSegmentIfNewerAsync_StaleValue_DoesNotRevertLegacyKeyOrIndex()
    {
        var sut = _sut!;
        var db = _mux!.GetDatabase();

        var envId = Guid.NewGuid();
        var segmentId = Guid.NewGuid();
        var segmentIdString = segmentId.ToString();
        var envIds = new[] { envId };

        var valueKey = RedisKeys.Segment(segmentId);
        var indexKey = RedisKeys.SegmentIndex(envId);

        try
        {
            var ts2 = 2_000L;
            var segmentAtTs2 = NewSegment(envId, segmentId, included: ["alice", "bob"], ts2);
            await sut.UpsertSegmentAsync(envIds, segmentAtTs2);
            Assert.Equal(ts2, await db.SortedSetScoreAsync(indexKey, segmentIdString));

            var ts1 = 1_000L;
            var segmentAtTs1 = NewSegment(envId, segmentId, included: ["alice"], ts1);
            var accepted = await sut.UpsertSegmentIfNewerAsync(envIds, segmentAtTs1);

            // ACCEPTANCE: the legacy value + index must still reflect ts2, not reverted to ts1.
            var storedJson = (string?)await db.StringGetAsync(valueKey);
            Assert.Contains("bob", storedJson);
            Assert.Equal(ts2, await db.SortedSetScoreAsync(indexKey, segmentIdString));
            Assert.False(accepted, "#105: a guard-rejected stale upsert must be reported as NOT accepted");
        }
        finally
        {
            await db.KeyDeleteAsync(valueKey);
            await db.SortedSetRemoveAsync(indexKey, segmentIdString);
        }
    }

    [DockerFact]
    public async Task UpsertSegmentIfNewerAsync_NewerValue_StillAdvancesLegacyKeyAndIndex()
    {
        var sut = _sut!;
        var db = _mux!.GetDatabase();

        var envId = Guid.NewGuid();
        var segmentId = Guid.NewGuid();
        var segmentIdString = segmentId.ToString();
        var envIds = new[] { envId };

        var valueKey = RedisKeys.Segment(segmentId);
        var indexKey = RedisKeys.SegmentIndex(envId);

        try
        {
            var ts1 = 1_000L;
            var segmentAtTs1 = NewSegment(envId, segmentId, included: ["alice"], ts1);
            Assert.True(await sut.UpsertSegmentIfNewerAsync(envIds, segmentAtTs1));

            var ts2 = 2_000L;
            var segmentAtTs2 = NewSegment(envId, segmentId, included: ["alice", "bob"], ts2);
            var accepted = await sut.UpsertSegmentIfNewerAsync(envIds, segmentAtTs2);

            var storedJson = (string?)await db.StringGetAsync(valueKey);
            Assert.Contains("bob", storedJson);
            Assert.Equal(ts2, await db.SortedSetScoreAsync(indexKey, segmentIdString));
            Assert.True(accepted, "#105: a genuinely advancing upsert must be reported as accepted");
        }
        finally
        {
            await db.KeyDeleteAsync(valueKey);
            await db.SortedSetRemoveAsync(indexKey, segmentIdString);
        }
    }

    // ----- UpsertSegmentIfNewerAsync: multi-env desync cases (#103) -----
    //
    // These reproduce the #98 review finding: the pre-fix script gated on ONLY the FIRST env index
    // (KEYS[2]) instead of the max across every passed index, and moved every other index with a
    // plain (non-GT) ZADD. Per-env index desync is reachable in production because the normal
    // UpsertSegmentAsync writes each env's index in a separate round trip (a crash mid-loop desyncs
    // them), and envIds ordering from the caller is not guaranteed stable.

    [DockerFact]
    public async Task UpsertSegmentIfNewerAsync_DesyncedIndexesLaggingEnvFirst_DoesNotRevertValueAndNeverMovesAnIndexBackward()
    {
        var sut = _sut!;
        var db = _mux!.GetDatabase();

        var envA = Guid.NewGuid(); // already fresh, at ts=200
        var envB = Guid.NewGuid(); // desynced/lagging behind, at ts=50
        var segmentId = Guid.NewGuid();
        var segmentIdString = segmentId.ToString();

        var valueKey = RedisKeys.Segment(segmentId);
        var indexKeyA = RedisKeys.SegmentIndex(envA);
        var indexKeyB = RedisKeys.SegmentIndex(envB);

        try
        {
            // envA is genuinely at ts=200 (value + index written together, in sync).
            var ts200 = 200L;
            var segmentAtTs200 = NewSegment(envA, segmentId, included: ["alice", "bob"], ts200);
            await sut.UpsertSegmentAsync([envA], segmentAtTs200);
            Assert.Equal(ts200, await db.SortedSetScoreAsync(indexKeyA, segmentIdString));

            // envB's index is desynced (e.g. a crash mid-loop left it behind at ts=50).
            var ts50 = 50L;
            await db.SortedSetAddAsync(indexKeyB, segmentIdString, ts50);

            // A backfill holding a stale ts=100 snapshot arrives, envIds ordered lagging-env-first.
            var ts100 = 100L;
            var segmentAtTs100 = NewSegment(envA, segmentId, included: ["alice"], ts100);
            var accepted = await sut.UpsertSegmentIfNewerAsync([envB, envA], segmentAtTs100);

            // ACCEPTANCE: ts=100 is not strictly newer than EVERY env's index (envA is at 200), so the
            // value key must NOT be overwritten with the stale ts=100 content.
            var storedJson = (string?)await db.StringGetAsync(valueKey);
            Assert.Contains("bob", storedJson);
            // #105: the value write was guard-rejected, so this must report NOT accepted — even
            // though envB's own index still independently caught up (asserted below).
            Assert.False(accepted, "#105: a guard-rejected value write must be reported as NOT accepted");

            // ACCEPTANCE: envA's index must never move backward (100 < 200, so it stays at 200).
            Assert.Equal(ts200, await db.SortedSetScoreAsync(indexKeyA, segmentIdString));

            // envB's own index is still free to independently catch up toward ts=100 (100 > its own
            // 50) via per-key GT, even though the value write was blocked by the *other* (fresher) env.
            Assert.Equal(ts100, await db.SortedSetScoreAsync(indexKeyB, segmentIdString));
        }
        finally
        {
            await db.KeyDeleteAsync(valueKey);
            await db.SortedSetRemoveAsync(indexKeyA, segmentIdString);
            await db.SortedSetRemoveAsync(indexKeyB, segmentIdString);
        }
    }

    [DockerFact]
    public async Task UpsertSegmentIfNewerAsync_GenuinelyStaleAcrossAllEnvs_AdvancesEveryIndexAndWritesValue()
    {
        var sut = _sut!;
        var db = _mux!.GetDatabase();

        var envA = Guid.NewGuid();
        var envB = Guid.NewGuid();
        var segmentId = Guid.NewGuid();
        var segmentIdString = segmentId.ToString();

        var valueKey = RedisKeys.Segment(segmentId);
        var indexKeyA = RedisKeys.SegmentIndex(envA);
        var indexKeyB = RedisKeys.SegmentIndex(envB);

        try
        {
            // Both envs are stale relative to the incoming write (desynced at different low scores).
            await db.SortedSetAddAsync(indexKeyA, segmentIdString, 50L);
            await db.SortedSetAddAsync(indexKeyB, segmentIdString, 80L);

            var ts200 = 200L;
            var segmentAtTs200 = NewSegment(envA, segmentId, included: ["alice", "bob"], ts200);
            var accepted = await sut.UpsertSegmentIfNewerAsync([envA, envB], segmentAtTs200);

            // ACCEPTANCE: ts=200 is strictly newer than every env's index (max(50, 80) = 80), so the
            // value key IS written and every env's index advances to ts=200.
            var storedJson = (string?)await db.StringGetAsync(valueKey);
            Assert.Contains("bob", storedJson);
            Assert.Equal(ts200, await db.SortedSetScoreAsync(indexKeyA, segmentIdString));
            Assert.Equal(ts200, await db.SortedSetScoreAsync(indexKeyB, segmentIdString));
            Assert.True(accepted, "#105: a genuinely advancing value write must be reported as accepted");
        }
        finally
        {
            await db.KeyDeleteAsync(valueKey);
            await db.SortedSetRemoveAsync(indexKeyA, segmentIdString);
            await db.SortedSetRemoveAsync(indexKeyB, segmentIdString);
        }
    }

    [DockerFact]
    public async Task UpsertSegmentIfNewerAsync_MixedFreshness_PerKeyGtAdvancesOnlyTheLaggingIndex()
    {
        var sut = _sut!;
        var db = _mux!.GetDatabase();

        var envA = Guid.NewGuid(); // already fresh, at ts=300 (ahead of the incoming write)
        var envB = Guid.NewGuid(); // desynced/lagging behind, at ts=50
        var segmentId = Guid.NewGuid();
        var segmentIdString = segmentId.ToString();

        var valueKey = RedisKeys.Segment(segmentId);
        var indexKeyA = RedisKeys.SegmentIndex(envA);
        var indexKeyB = RedisKeys.SegmentIndex(envB);

        try
        {
            // envA is genuinely at ts=300 (value + index written together, in sync).
            var ts300 = 300L;
            var segmentAtTs300 = NewSegment(envA, segmentId, included: ["alice", "bob"], ts300);
            await sut.UpsertSegmentAsync([envA], segmentAtTs300);

            // envB's index is desynced, lagging far behind at ts=50.
            var ts50 = 50L;
            await db.SortedSetAddAsync(indexKeyB, segmentIdString, ts50);

            // A write for ts=150 arrives: newer than envB's index but older than envA's.
            var ts150 = 150L;
            var segmentAtTs150 = NewSegment(envA, segmentId, included: ["carol"], ts150);
            var accepted = await sut.UpsertSegmentIfNewerAsync([envA, envB], segmentAtTs150);

            // ACCEPTANCE (value-key decision, documented invariant): ts=150 is NOT strictly newer than
            // EVERY env's index (envA is at 300), so the value key must NOT be overwritten.
            var storedJson = (string?)await db.StringGetAsync(valueKey);
            Assert.Contains("bob", storedJson);
            Assert.DoesNotContain("carol", storedJson);
            Assert.False(accepted, "#105: a guard-rejected value write must be reported as NOT accepted");

            // ACCEPTANCE: envA's already-fresher index is left untouched by GT (150 < 300).
            Assert.Equal(ts300, await db.SortedSetScoreAsync(indexKeyA, segmentIdString));

            // ACCEPTANCE: envB's lagging index still independently advances via per-key GT (150 > 50).
            Assert.Equal(ts150, await db.SortedSetScoreAsync(indexKeyB, segmentIdString));
        }
        finally
        {
            await db.KeyDeleteAsync(valueKey);
            await db.SortedSetRemoveAsync(indexKeyA, segmentIdString);
            await db.SortedSetRemoveAsync(indexKeyB, segmentIdString);
        }
    }

    private static FeatureFlag NewFlag(Guid envId, Guid flagId, bool isEnabled, long ts)
    {
        var enabledVariationId = Guid.NewGuid().ToString();
        var disabledVariationId = Guid.NewGuid().ToString();

        var flag = new FeatureFlag(
            envId: envId,
            name: "test-flag",
            description: string.Empty,
            key: "test-flag",
            isEnabled: isEnabled,
            variationType: "boolean",
            variations:
            [
                new Variation { Id = enabledVariationId, Name = "true", Value = "true" },
                new Variation { Id = disabledVariationId, Name = "false", Value = "false" }
            ],
            disabledVariationId: disabledVariationId,
            enabledVariationId: enabledVariationId,
            tags: [],
            currentUserId: Guid.NewGuid())
        {
            Id = flagId,
            UpdatedAt = DateTimeOffset.FromUnixTimeMilliseconds(ts).UtcDateTime
        };

        return flag;
    }

    private static Segment NewSegment(Guid envId, Guid segmentId, string[] included, long ts)
    {
        var segment = new Segment(
            workspaceId: Guid.NewGuid(),
            envId: envId,
            name: "test-segment",
            key: "test-segment",
            type: SegmentType.EnvironmentSpecific,
            scopes: [],
            included: included,
            excluded: [],
            rules: [],
            description: string.Empty)
        {
            Id = segmentId,
            UpdatedAt = DateTimeOffset.FromUnixTimeMilliseconds(ts).UtcDateTime
        };

        return segment;
    }

    private sealed class TestRedisClient(IConnectionMultiplexer connection) : IRedisClient
    {
        public IConnectionMultiplexer Connection { get; } = connection;

        public IDatabase GetDatabase() => Connection.GetDatabase();
    }
}

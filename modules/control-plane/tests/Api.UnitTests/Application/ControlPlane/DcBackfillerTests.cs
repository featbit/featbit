using System.Linq.Expressions;
using Api.Application.ControlPlane;
using Api.Infrastructure.Caches;
using Application.Caches;
using Application.ControlPlane;
using Application.Services;
using Domain.FeatureFlags;
using Domain.Messages;
using Domain.Segments;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Time.Testing;
using Moq;

namespace Api.UnitTests.Application.ControlPlane;

/// <summary>
/// #92 unit coverage for <see cref="DcBackfiller"/>'s per-DC in-flight coalescing (moved here from
/// <c>CacheReconciler</c> so BOTH <see cref="RecoveryWorker"/> and <c>CacheReconciler</c> coalesce
/// against each other via this shared singleton) and the <see cref="IDcBackfiller.IsCompositeCacheAvailable"/>
/// guard. Uses a REAL <see cref="CompositeRedisCacheService"/> wired with mocked <see cref="ICacheService"/>
/// instances (same pattern as <c>CompositeRedisCacheServiceTests</c>) so <see cref="DcBackfiller"/>'s
/// internal cast (<c>compositeCache is CompositeRedisCacheService</c>) succeeds without real Redis.
/// </summary>
public class DcBackfillerTests
{
    private static readonly CommittedSnapshot EmptySnapshot = new(
        Array.Empty<FeatureFlag>(),
        Array.Empty<Domain.Segments.Segment>(),
        new Dictionary<string, ICollection<Guid>>(),
        Array.Empty<Domain.Environments.SecretCache>());

    private readonly Mock<IMessageProducer> _producer = new();

    public DcBackfillerTests()
    {
        _producer
            .Setup(p => p.PublishAsync(It.IsAny<string>(), It.IsAny<ControlPlaneCommand>()))
            .Returns(Task.CompletedTask);
    }

    private static FeatureFlag CreateFlag(string key = "flag-1") => new(
        envId: Guid.NewGuid(),
        name: key,
        description: string.Empty,
        key: key,
        isEnabled: true,
        variationType: "boolean",
        variations:
        [
            new Variation { Id = Guid.NewGuid().ToString(), Name = "true", Value = "true" },
            new Variation { Id = Guid.NewGuid().ToString(), Name = "false", Value = "false" }
        ],
        disabledVariationId: Guid.NewGuid().ToString(),
        enabledVariationId: Guid.NewGuid().ToString(),
        tags: [],
        currentUserId: Guid.NewGuid());

    // Pruning deleted entries is off unless a test turns it on, so the tests of the writes stay about the writes.
    private DcBackfiller CreateSut(
        ICacheService compositeCache,
        IServiceScopeFactory? scopeFactory = null,
        IConfiguration? configuration = null,
        TimeProvider? timeProvider = null) =>
        new(
            scopeFactory ?? Mock.Of<IServiceScopeFactory>(),
            compositeCache,
            _producer.Object,
            configuration ?? PruneSettings("Off"),
            NullLogger<DcBackfiller>.Instance,
            timeProvider);

    private static IConfiguration PruneSettings(string mode, int? maxRemovals = null, int? minAgeSeconds = null)
    {
        var values = new Dictionary<string, string?> { ["ControlPlane:CacheReconcile:PruneDeleted:Mode"] = mode };
        if (maxRemovals is not null)
        {
            values["ControlPlane:CacheReconcile:PruneDeleted:MaxRemovalsPerRun"] = maxRemovals.ToString();
        }

        if (minAgeSeconds is not null)
        {
            values["ControlPlane:CacheReconcile:PruneDeleted:MinAgeSeconds"] = minAgeSeconds.ToString();
        }

        return new ConfigurationBuilder().AddInMemoryCollection(values).Build();
    }

    [Fact]
    public async Task ConcurrentBackfillsForSameDc_AreCoalesced()
    {
        // A gate on the underlying Redis write lets the test control exactly when the "in-flight"
        // first call completes, so a second concurrent call for the SAME DcId can be proven to see it
        // as in-flight and return immediately instead of doing its own read/write cycle.
        var gate = new TaskCompletionSource();
        var dcCache = new Mock<ICacheService>();
        dcCache
            .Setup(s => s.StageFlagAsync(It.IsAny<FeatureFlag>(), It.IsAny<long>()))
            .Returns(async () =>
            {
                await gate.Task;
                return true;
            });
        dcCache.Setup(s => s.CommitFlagAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<long>()))
            .ReturnsAsync(true);

        var composite = new CompositeRedisCacheService(
            new[] { new DcCacheService("east", dcCache.Object) },
            NullLogger<CompositeRedisCacheService>.Instance);

        var snapshot = EmptySnapshot with { Flags = [CreateFlag()] };
        var sut = CreateSut(composite);

        // First call: acquires the in-flight slot, then blocks inside StageFlagAsync on the gate.
        var first = sut.BackfillDcAsync("east", ConsistencyMode.GatedCommit, snapshot);

        // Second call for the SAME DcId: must see "east" already in flight and return immediately
        // WITHOUT touching Redis (StageFlagAsync/CommitFlagAsync are never invoked for this call).
        var second = await sut.BackfillDcAsync("east", ConsistencyMode.GatedCommit, snapshot);
        Assert.Equal(IDcBackfiller.Skipped, second);

        // Release the first call and let it complete normally.
        gate.SetResult();
        var firstResult = await first;
        Assert.Equal(1, firstResult); // 1 flag actually written

        dcCache.Verify(s => s.StageFlagAsync(It.IsAny<FeatureFlag>(), It.IsAny<long>()), Times.Once);
        dcCache.Verify(s => s.CommitFlagAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<long>()), Times.Once);
    }

    [Fact]
    public async Task SequentialBackfillsForSameDc_AreNotCoalesced()
    {
        // The in-flight slot is released (finally) once a backfill completes, so a LATER (not
        // concurrent) call for the same DcId must run normally, not be treated as coalesced.
        var dcCache = new Mock<ICacheService>();
        dcCache.Setup(s => s.StageFlagAsync(It.IsAny<FeatureFlag>(), It.IsAny<long>())).ReturnsAsync(true);
        dcCache.Setup(s => s.CommitFlagAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<long>())).ReturnsAsync(true);

        var composite = new CompositeRedisCacheService(
            new[] { new DcCacheService("east", dcCache.Object) },
            NullLogger<CompositeRedisCacheService>.Instance);

        var snapshot = EmptySnapshot with { Flags = [CreateFlag()] };
        var sut = CreateSut(composite);

        var first = await sut.BackfillDcAsync("east", ConsistencyMode.GatedCommit, snapshot);
        var second = await sut.BackfillDcAsync("east", ConsistencyMode.GatedCommit, snapshot);

        Assert.Equal(1, first);
        Assert.Equal(1, second);
        dcCache.Verify(s => s.StageFlagAsync(It.IsAny<FeatureFlag>(), It.IsAny<long>()), Times.Exactly(2));
    }

    [Fact]
    public async Task ConcurrentBackfillsForDifferentDcs_DoNotCoalesceWithEachOther()
    {
        var gate = new TaskCompletionSource();
        var eastCache = new Mock<ICacheService>();
        eastCache
            .Setup(s => s.StageFlagAsync(It.IsAny<FeatureFlag>(), It.IsAny<long>()))
            .Returns(async () =>
            {
                await gate.Task;
                return true;
            });
        eastCache.Setup(s => s.CommitFlagAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<long>()))
            .ReturnsAsync(true);

        var westCache = new Mock<ICacheService>();
        westCache.Setup(s => s.StageFlagAsync(It.IsAny<FeatureFlag>(), It.IsAny<long>())).ReturnsAsync(true);
        westCache.Setup(s => s.CommitFlagAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<long>())).ReturnsAsync(true);

        var composite = new CompositeRedisCacheService(
            new[]
            {
                new DcCacheService("east", eastCache.Object),
                new DcCacheService("west", westCache.Object)
            },
            NullLogger<CompositeRedisCacheService>.Instance);

        var snapshot = EmptySnapshot with { Flags = [CreateFlag()] };
        var sut = CreateSut(composite);

        var eastTask = sut.BackfillDcAsync("east", ConsistencyMode.GatedCommit, snapshot); // blocks on gate
        var westResult = await sut.BackfillDcAsync("west", ConsistencyMode.GatedCommit, snapshot); // different DcId

        Assert.Equal(1, westResult); // "west" is NOT coalesced by "east" being in flight

        gate.SetResult();
        Assert.Equal(1, await eastTask);
    }

    [Fact]
    public void IsCompositeCacheAvailable_TrueForCompositeRedisCacheService()
    {
        var composite = new CompositeRedisCacheService(
            Array.Empty<DcCacheService>(),
            NullLogger<CompositeRedisCacheService>.Instance);
        var sut = CreateSut(composite);

        Assert.True(sut.IsCompositeCacheAvailable);
    }

    [Fact]
    public void IsCompositeCacheAvailable_FalseForNonCompositeCache()
    {
        var sut = CreateSut(Mock.Of<ICacheService>());

        Assert.False(sut.IsCompositeCacheAvailable);
    }

    [Fact]
    public async Task BackfillDcAsync_WhenCompositeCacheUnavailable_ReturnsSkipped_NotZero()
    {
        // Distinguishes a real misconfiguration (Skipped) from a legitimate zero-flag snapshot (0) —
        // callers rely on this to count honest repairs (#92).
        var sut = CreateSut(Mock.Of<ICacheService>());

        var result = await sut.BackfillDcAsync("east", ConsistencyMode.GatedCommit, EmptySnapshot);

        Assert.Equal(IDcBackfiller.Skipped, result);
        Assert.NotEqual(0, IDcBackfiller.Skipped);
    }

    [Fact]
    public async Task BackfillDcAsync_WithEmptySnapshot_ReturnsZero_NotSkipped()
    {
        // A legitimate "nothing to write this tick" (a wholly empty snapshot: zero flags, zero
        // segments, zero secrets) must be distinguishable from a skip.
        var composite = new CompositeRedisCacheService(
            new[] { new DcCacheService("east", Mock.Of<ICacheService>()) },
            NullLogger<CompositeRedisCacheService>.Instance);
        var sut = CreateSut(composite);

        var result = await sut.BackfillDcAsync("east", ConsistencyMode.GatedCommit, EmptySnapshot);

        Assert.Equal(0, result);
    }

    // ----- #105: honest "accepted" (not merely attempted) counts -----

    [Fact]
    public async Task BackfillDcAsync_GatedCommit_WhenGuardRejectsEveryCommit_ReturnsZero_NotAttemptedCount()
    {
        // Simulates the DC's Redis already holding an equal/fresher committed version for every
        // flag (the only-advance guard rejects every commit as a no-op). Stage always "succeeds"
        // (it is unconditional), but Commit — the actual guard — reports false for every flag, so
        // this backfill accepted NOTHING even though it attempted (and successfully staged) one
        // flag. Before #105 this incorrectly returned the ATTEMPTED count (1); it must now return 0.
        var dcCache = new Mock<ICacheService>();
        dcCache.Setup(s => s.StageFlagAsync(It.IsAny<FeatureFlag>(), It.IsAny<long>())).ReturnsAsync(true);
        dcCache.Setup(s => s.CommitFlagAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<long>()))
            .ReturnsAsync(false);

        var composite = new CompositeRedisCacheService(
            new[] { new DcCacheService("east", dcCache.Object) },
            NullLogger<CompositeRedisCacheService>.Instance);

        var snapshot = EmptySnapshot with { Flags = [CreateFlag()] };
        var sut = CreateSut(composite);

        var result = await sut.BackfillDcAsync("east", ConsistencyMode.GatedCommit, snapshot);

        Assert.Equal(0, result);
        dcCache.Verify(s => s.CommitFlagAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<long>()), Times.Once);
    }

    [Fact]
    public async Task BackfillDcAsync_BestEffort_WhenGuardRejectsEveryUpsert_ReturnsZero_NotAttemptedCount()
    {
        // BestEffort counterpart: UpsertFlagIfNewerAsync itself carries the guard. A guard-rejected
        // upsert (the DC already holds a fresher legacy value) must not be counted as a repair.
        var dcCache = new Mock<ICacheService>();
        dcCache.Setup(s => s.UpsertFlagIfNewerAsync(It.IsAny<FeatureFlag>())).ReturnsAsync(false);

        var composite = new CompositeRedisCacheService(
            new[] { new DcCacheService("east", dcCache.Object) },
            NullLogger<CompositeRedisCacheService>.Instance);

        var snapshot = EmptySnapshot with { Flags = [CreateFlag()] };
        var sut = CreateSut(composite);

        var result = await sut.BackfillDcAsync("east", ConsistencyMode.BestEffort, snapshot);

        Assert.Equal(0, result);
    }

    [Fact]
    public async Task BackfillDcAsync_GatedCommit_MixedAcceptedAndRejected_ReturnsOnlyAcceptedCount()
    {
        // Two flags attempted; only the second's commit is accepted by the guard. The returned
        // count must reflect ONLY the accepted one (1), not the attempted count (2).
        var dcCache = new Mock<ICacheService>();
        dcCache.Setup(s => s.StageFlagAsync(It.IsAny<FeatureFlag>(), It.IsAny<long>())).ReturnsAsync(true);
        dcCache.SetupSequence(s => s.CommitFlagAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<long>()))
            .ReturnsAsync(false)
            .ReturnsAsync(true);

        var composite = new CompositeRedisCacheService(
            new[] { new DcCacheService("east", dcCache.Object) },
            NullLogger<CompositeRedisCacheService>.Instance);

        var snapshot = EmptySnapshot with { Flags = [CreateFlag("flag-1"), CreateFlag("flag-2")] };
        var sut = CreateSut(composite);

        var result = await sut.BackfillDcAsync("east", ConsistencyMode.GatedCommit, snapshot);

        Assert.Equal(1, result);
    }

    // ----- pruning the flags and segments the source of truth no longer has -----

    private static readonly DateTimeOffset Now = new(2026, 1, 2, 3, 0, 0, TimeSpan.Zero);
    private static readonly long OldScore = Now.AddHours(-1).ToUnixTimeMilliseconds();
    private static readonly long RecentScore = Now.AddMinutes(-1).ToUnixTimeMilliseconds();

    private static IReadOnlyDictionary<Guid, long> Index(params (Guid Id, long Score)[] entries) =>
        entries.ToDictionary(e => e.Id, e => e.Score);

    private sealed record PruneFixture(
        DcBackfiller Sut,
        Mock<ICacheService> East,
        Mock<ICacheService> West,
        Mock<IFeatureFlagService> Flags,
        Mock<ISegmentService> Segments,
        CommittedSnapshot Snapshot,
        Guid EnvA,
        Guid EnvB,
        FakeTimeProvider Time);

    // East is the DC under test and lists whatever a test sets up. Every value it holds is archived and the
    // database holds nothing beyond the snapshot, so a test changes only the one thing it is about.
    private PruneFixture CreatePruneFixture(string mode = "On", int? maxRemovals = null)
    {
        var east = new Mock<ICacheService>();
        // An index that nothing was set up for is empty, as in Redis, not unreadable (a null answer).
        east.Setup(s => s.GetFlagIndexAsync(It.IsAny<Guid>())).ReturnsAsync(Index());
        east.Setup(s => s.GetSegmentIndexAsync(It.IsAny<Guid>())).ReturnsAsync(Index());
        east.Setup(s => s.IsFlagArchivedAsync(It.IsAny<Guid>(), It.IsAny<ConsistencyMode>())).ReturnsAsync(true);
        east.Setup(s => s.IsSegmentArchivedAsync(It.IsAny<Guid>(), It.IsAny<ConsistencyMode>())).ReturnsAsync(true);
        var west = new Mock<ICacheService>();

        var flags = new Mock<IFeatureFlagService>();
        flags.Setup(s => s.AnyAsync(It.IsAny<Expression<Func<FeatureFlag, bool>>>())).ReturnsAsync(false);
        var segments = new Mock<ISegmentService>();
        segments.Setup(s => s.AnyAsync(It.IsAny<Expression<Func<Segment, bool>>>())).ReturnsAsync(false);

        var services = new ServiceCollection();
        services.AddTransient(_ => flags.Object);
        services.AddTransient(_ => segments.Object);

        var composite = new CompositeRedisCacheService(
            new[] { new DcCacheService("east", east.Object), new DcCacheService("west", west.Object) },
            NullLogger<CompositeRedisCacheService>.Instance);

        var liveA = CreateFlag("live-a");
        liveA.Id = Guid.NewGuid();
        var liveB = CreateFlag("live-b");
        liveB.Id = Guid.NewGuid();
        var snapshot = EmptySnapshot with { Flags = [liveA, liveB] };

        var time = new FakeTimeProvider(Now);
        var sut = CreateSut(
            composite,
            services.BuildServiceProvider().GetRequiredService<IServiceScopeFactory>(),
            PruneSettings(mode, maxRemovals),
            time);

        return new PruneFixture(sut, east, west, flags, segments, snapshot, liveA.EnvId, liveB.EnvId, time);
    }

    [Fact]
    public async Task BackfillDcAsync_DeletedFlagStillListed_RemovesItFromThatDcOnly()
    {
        var f = CreatePruneFixture();
        var orphan = Guid.NewGuid();
        f.East.Setup(s => s.GetFlagIndexAsync(f.EnvA)).ReturnsAsync(Index((orphan, OldScore)));

        var result = await f.Sut.BackfillDcAsync("east", ConsistencyMode.BestEffort, f.Snapshot);

        f.East.Verify(s => s.DeleteFlagAsync(f.EnvA, orphan), Times.Once);
        f.West.Verify(s => s.DeleteFlagAsync(It.IsAny<Guid>(), It.IsAny<Guid>()), Times.Never);
        f.West.Verify(s => s.GetFlagIndexAsync(It.IsAny<Guid>()), Times.Never);
        Assert.Equal(1, result);
    }

    [Fact]
    public async Task BackfillDcAsync_ListedFlagIsInTheSnapshot_IsNotRemoved()
    {
        var f = CreatePruneFixture();
        var live = f.Snapshot.Flags[0];
        f.East.Setup(s => s.GetFlagIndexAsync(f.EnvA)).ReturnsAsync(Index((live.Id, OldScore)));

        await f.Sut.BackfillDcAsync("east", ConsistencyMode.BestEffort, f.Snapshot);

        f.East.Verify(s => s.DeleteFlagAsync(It.IsAny<Guid>(), It.IsAny<Guid>()), Times.Never);
    }

    [Fact]
    public async Task BackfillDcAsync_ListedFlagWasChangedRecently_IsNotRemoved()
    {
        var f = CreatePruneFixture();
        f.East.Setup(s => s.GetFlagIndexAsync(f.EnvA)).ReturnsAsync(Index((Guid.NewGuid(), RecentScore)));

        await f.Sut.BackfillDcAsync("east", ConsistencyMode.BestEffort, f.Snapshot);

        f.East.Verify(s => s.DeleteFlagAsync(It.IsAny<Guid>(), It.IsAny<Guid>()), Times.Never);
    }

    [Fact]
    public async Task BackfillDcAsync_ListedFlagIsNotArchivedInTheDc_IsNotRemoved()
    {
        var f = CreatePruneFixture();
        var orphan = Guid.NewGuid();
        f.East.Setup(s => s.GetFlagIndexAsync(f.EnvA)).ReturnsAsync(Index((orphan, OldScore)));
        f.East.Setup(s => s.IsFlagArchivedAsync(orphan, It.IsAny<ConsistencyMode>())).ReturnsAsync(false);

        await f.Sut.BackfillDcAsync("east", ConsistencyMode.BestEffort, f.Snapshot);

        f.East.Verify(s => s.DeleteFlagAsync(It.IsAny<Guid>(), It.IsAny<Guid>()), Times.Never);
    }

    [Fact]
    public async Task BackfillDcAsync_ListedFlagIsStillInTheDatabase_IsNotRemoved()
    {
        var f = CreatePruneFixture();
        var orphan = Guid.NewGuid();
        f.East.Setup(s => s.GetFlagIndexAsync(f.EnvA)).ReturnsAsync(Index((orphan, OldScore)));
        f.Flags.Setup(s => s.AnyAsync(It.IsAny<Expression<Func<FeatureFlag, bool>>>())).ReturnsAsync(true);

        await f.Sut.BackfillDcAsync("east", ConsistencyMode.BestEffort, f.Snapshot);

        f.East.Verify(s => s.DeleteFlagAsync(It.IsAny<Guid>(), It.IsAny<Guid>()), Times.Never);
    }

    [Fact]
    public async Task BackfillDcAsync_SnapshotHasSecretsButNoFlagsOrSegments_PrunesNothing()
    {
        // A snapshot with no flags and no segments is far more likely to be a failed or empty read than a
        // database where everything was deleted. The environment is still known, from its secret, so without
        // the guard every entry the DC lists for it would look deleted.
        var f = CreatePruneFixture();
        var secret = new Domain.Environments.SecretCache(
            new Domain.Environments.ResourceDescriptor
            {
                Environment = new Domain.Environments.IdNameKeyProps { Id = f.EnvA, Name = "env", Key = "env" }
            },
            new Domain.Environments.Secret(f.EnvA, "key", "server"));
        var snapshot = EmptySnapshot with { Secrets = [secret] };
        f.East.Setup(s => s.GetFlagIndexAsync(f.EnvA)).ReturnsAsync(Index((Guid.NewGuid(), OldScore)));

        await f.Sut.BackfillDcAsync("east", ConsistencyMode.BestEffort, snapshot);

        f.East.Verify(s => s.GetFlagIndexAsync(It.IsAny<Guid>()), Times.Never);
        f.East.Verify(s => s.DeleteFlagAsync(It.IsAny<Guid>(), It.IsAny<Guid>()), Times.Never);
    }

    [Fact]
    public async Task BackfillDcAsync_EnvironmentWithNoFlagsLeft_IsFoundThroughItsSecrets()
    {
        // Every flag of environment B was deleted, so the snapshot holds none of its flags; its secret is how
        // the environment is still found and its leftover entry removed.
        var f = CreatePruneFixture();
        var envC = Guid.NewGuid();
        var orphan = Guid.NewGuid();
        var secret = new Domain.Environments.SecretCache(
            new Domain.Environments.ResourceDescriptor
            {
                Environment = new Domain.Environments.IdNameKeyProps { Id = envC, Name = "env", Key = "env" }
            },
            new Domain.Environments.Secret(envC, "key", "server"));
        var snapshot = f.Snapshot with { Secrets = [secret] };
        f.East.Setup(s => s.GetFlagIndexAsync(envC)).ReturnsAsync(Index((orphan, OldScore)));

        await f.Sut.BackfillDcAsync("east", ConsistencyMode.BestEffort, snapshot);

        f.East.Verify(s => s.DeleteFlagAsync(envC, orphan), Times.Once);
    }

    [Fact]
    public async Task BackfillDcAsync_MoreDeletedEntriesThanTheLimit_RemovesNone()
    {
        var f = CreatePruneFixture(maxRemovals: 1);
        f.East.Setup(s => s.GetFlagIndexAsync(f.EnvA))
            .ReturnsAsync(Index((Guid.NewGuid(), OldScore), (Guid.NewGuid(), OldScore)));

        var result = await f.Sut.BackfillDcAsync("east", ConsistencyMode.BestEffort, f.Snapshot);

        f.East.Verify(s => s.DeleteFlagAsync(It.IsAny<Guid>(), It.IsAny<Guid>()), Times.Never);
        Assert.Equal(0, result);
    }

    [Fact]
    public async Task BackfillDcAsync_DryRun_RemovesNothing()
    {
        var f = CreatePruneFixture(mode: "DryRun");
        f.East.Setup(s => s.GetFlagIndexAsync(f.EnvA)).ReturnsAsync(Index((Guid.NewGuid(), OldScore)));

        var result = await f.Sut.BackfillDcAsync("east", ConsistencyMode.BestEffort, f.Snapshot);

        f.East.Verify(s => s.DeleteFlagAsync(It.IsAny<Guid>(), It.IsAny<Guid>()), Times.Never);
        Assert.Equal(0, result);
    }

    [Fact]
    public async Task BackfillDcAsync_PruningOff_ReadsNoIndex()
    {
        var f = CreatePruneFixture(mode: "Off");

        await f.Sut.BackfillDcAsync("east", ConsistencyMode.BestEffort, f.Snapshot);

        f.East.Verify(s => s.GetFlagIndexAsync(It.IsAny<Guid>()), Times.Never);
        f.East.Verify(s => s.GetSegmentIndexAsync(It.IsAny<Guid>()), Times.Never);
    }

    [Fact]
    public async Task BackfillDcAsync_DeletedSegmentListedInTwoEnvironments_IsRemovedOnceWithBoth()
    {
        var f = CreatePruneFixture();
        var orphan = Guid.NewGuid();
        f.East.Setup(s => s.GetSegmentIndexAsync(f.EnvA)).ReturnsAsync(Index((orphan, OldScore)));
        f.East.Setup(s => s.GetSegmentIndexAsync(f.EnvB)).ReturnsAsync(Index((orphan, OldScore)));

        var result = await f.Sut.BackfillDcAsync("east", ConsistencyMode.BestEffort, f.Snapshot);

        f.East.Verify(
            s => s.DeleteSegmentAsync(
                It.Is<ICollection<Guid>>(ids => ids.OrderBy(i => i).SequenceEqual(new[] { f.EnvA, f.EnvB }.OrderBy(i => i))),
                orphan),
            Times.Once);
        Assert.Equal(1, result);
    }

    [Fact]
    public async Task BackfillDcAsync_DeletedSegmentWasChangedRecentlyInOneEnvironment_IsNotRemoved()
    {
        var f = CreatePruneFixture();
        var orphan = Guid.NewGuid();
        f.East.Setup(s => s.GetSegmentIndexAsync(f.EnvA)).ReturnsAsync(Index((orphan, OldScore)));
        f.East.Setup(s => s.GetSegmentIndexAsync(f.EnvB)).ReturnsAsync(Index((orphan, RecentScore)));

        await f.Sut.BackfillDcAsync("east", ConsistencyMode.BestEffort, f.Snapshot);

        f.East.Verify(s => s.DeleteSegmentAsync(It.IsAny<ICollection<Guid>>(), It.IsAny<Guid>()), Times.Never);
    }

    [Fact]
    public async Task BackfillDcAsync_ListedSegmentIsNotArchivedInTheDc_IsNotRemoved()
    {
        var f = CreatePruneFixture();
        var orphan = Guid.NewGuid();
        f.East.Setup(s => s.GetSegmentIndexAsync(f.EnvA)).ReturnsAsync(Index((orphan, OldScore)));
        f.East.Setup(s => s.IsSegmentArchivedAsync(orphan, It.IsAny<ConsistencyMode>())).ReturnsAsync(false);

        await f.Sut.BackfillDcAsync("east", ConsistencyMode.BestEffort, f.Snapshot);

        f.East.Verify(s => s.DeleteSegmentAsync(It.IsAny<ICollection<Guid>>(), It.IsAny<Guid>()), Times.Never);
    }

    [Fact]
    public async Task BackfillDcAsync_ListedSegmentIsStillInTheDatabase_IsNotRemoved()
    {
        var f = CreatePruneFixture();
        f.East.Setup(s => s.GetSegmentIndexAsync(f.EnvA)).ReturnsAsync(Index((Guid.NewGuid(), OldScore)));
        f.Segments.Setup(s => s.AnyAsync(It.IsAny<Expression<Func<Segment, bool>>>())).ReturnsAsync(true);

        await f.Sut.BackfillDcAsync("east", ConsistencyMode.BestEffort, f.Snapshot);

        f.East.Verify(s => s.DeleteSegmentAsync(It.IsAny<ICollection<Guid>>(), It.IsAny<Guid>()), Times.Never);
    }

    [Fact]
    public async Task BackfillDcAsync_IndexCannotBeRead_RemovesNothingAndStillBackfills()
    {
        var f = CreatePruneFixture();
        f.East.Setup(s => s.GetFlagIndexAsync(It.IsAny<Guid>())).ThrowsAsync(new TimeoutException("redis"));
        f.East.Setup(s => s.UpsertFlagIfNewerAsync(It.IsAny<FeatureFlag>())).ReturnsAsync(true);

        var result = await f.Sut.BackfillDcAsync("east", ConsistencyMode.BestEffort, f.Snapshot);

        f.East.Verify(s => s.DeleteFlagAsync(It.IsAny<Guid>(), It.IsAny<Guid>()), Times.Never);
        Assert.Equal(2, result); // the two live flags were still written
    }

    [Fact]
    public async Task BackfillDcAsync_PruningThrows_DoesNotFailTheBackfill()
    {
        var f = CreatePruneFixture();
        f.East.Setup(s => s.GetFlagIndexAsync(f.EnvA)).ReturnsAsync(Index((Guid.NewGuid(), OldScore)));
        f.Flags.Setup(s => s.AnyAsync(It.IsAny<Expression<Func<FeatureFlag, bool>>>()))
            .ThrowsAsync(new InvalidOperationException("database down"));
        f.East.Setup(s => s.UpsertFlagIfNewerAsync(It.IsAny<FeatureFlag>())).ReturnsAsync(true);

        var result = await f.Sut.BackfillDcAsync("east", ConsistencyMode.BestEffort, f.Snapshot);

        f.East.Verify(s => s.DeleteFlagAsync(It.IsAny<Guid>(), It.IsAny<Guid>()), Times.Never);
        Assert.Equal(2, result);
    }

    // ----- entries left for later are looked at again -----

    [Fact]
    public async Task BackfillDcAsync_ListedFlagWasChangedRecently_IsPrunedLaterOnceItIsOldEnough()
    {
        var f = CreatePruneFixture();
        var orphan = Guid.NewGuid();
        f.East.Setup(s => s.GetFlagIndexAsync(f.EnvA)).ReturnsAsync(Index((orphan, RecentScore)));

        await f.Sut.BackfillDcAsync("east", ConsistencyMode.BestEffort, f.Snapshot);
        Assert.Empty(f.Sut.TakeDcsDueForPrune());
        f.East.Verify(s => s.DeleteFlagAsync(It.IsAny<Guid>(), It.IsAny<Guid>()), Times.Never);

        f.Time.Advance(TimeSpan.FromMinutes(10)); // the entry is now older than MinAgeSeconds
        Assert.Equal(["east"], f.Sut.TakeDcsDueForPrune());
        var removed = await f.Sut.PruneDcAsync("east", ConsistencyMode.BestEffort, f.Snapshot);

        Assert.Equal(1, removed);
        f.East.Verify(s => s.DeleteFlagAsync(f.EnvA, orphan), Times.Once);
    }

    [Fact]
    public async Task BackfillDcAsync_ListedSegmentWasChangedRecently_IsPrunedLaterOnceItIsOldEnough()
    {
        var f = CreatePruneFixture();
        var orphan = Guid.NewGuid();
        f.East.Setup(s => s.GetSegmentIndexAsync(f.EnvA)).ReturnsAsync(Index((orphan, RecentScore)));

        await f.Sut.BackfillDcAsync("east", ConsistencyMode.BestEffort, f.Snapshot);
        f.East.Verify(s => s.DeleteSegmentAsync(It.IsAny<ICollection<Guid>>(), It.IsAny<Guid>()), Times.Never);

        f.Time.Advance(TimeSpan.FromMinutes(10));
        Assert.Equal(["east"], f.Sut.TakeDcsDueForPrune());
        await f.Sut.PruneDcAsync("east", ConsistencyMode.BestEffort, f.Snapshot);

        f.East.Verify(
            s => s.DeleteSegmentAsync(It.Is<ICollection<Guid>>(ids => ids.SequenceEqual(new[] { f.EnvA })), orphan),
            Times.Once);
    }

    [Fact]
    public async Task TakeDcsDueForPrune_NothingWasLeftForLater_ReturnsNothing()
    {
        var f = CreatePruneFixture();
        f.East.Setup(s => s.GetFlagIndexAsync(f.EnvA)).ReturnsAsync(Index((Guid.NewGuid(), OldScore)));

        await f.Sut.BackfillDcAsync("east", ConsistencyMode.BestEffort, f.Snapshot);
        f.Time.Advance(TimeSpan.FromDays(1));

        Assert.Empty(f.Sut.TakeDcsDueForPrune());
    }

    [Fact]
    public async Task TakeDcsDueForPrune_ADcThatWasTaken_IsNotTakenAgainForAMinute()
    {
        var f = CreatePruneFixture();
        f.East.Setup(s => s.GetFlagIndexAsync(f.EnvA)).ReturnsAsync(Index((Guid.NewGuid(), RecentScore)));
        await f.Sut.BackfillDcAsync("east", ConsistencyMode.BestEffort, f.Snapshot);
        f.Time.Advance(TimeSpan.FromMinutes(10));

        Assert.Equal(["east"], f.Sut.TakeDcsDueForPrune());
        Assert.Empty(f.Sut.TakeDcsDueForPrune());

        f.Time.Advance(TimeSpan.FromSeconds(61));
        Assert.Equal(["east"], f.Sut.TakeDcsDueForPrune());
    }

    [Fact]
    public async Task BackfillDcAsync_FlagIndexCannotBeRead_IsRetriedInAMinute()
    {
        var f = CreatePruneFixture();
        f.East.Setup(s => s.GetFlagIndexAsync(f.EnvA)).ThrowsAsync(new TimeoutException("redis"));

        await f.Sut.BackfillDcAsync("east", ConsistencyMode.BestEffort, f.Snapshot);

        Assert.Empty(f.Sut.TakeDcsDueForPrune());
        f.Time.Advance(TimeSpan.FromSeconds(61));
        Assert.Equal(["east"], f.Sut.TakeDcsDueForPrune());
    }

    [Fact]
    public async Task BackfillDcAsync_PruningThrows_IsRetriedInAMinute()
    {
        var f = CreatePruneFixture();
        f.East.Setup(s => s.GetFlagIndexAsync(f.EnvA)).ReturnsAsync(Index((Guid.NewGuid(), OldScore)));
        f.Flags.Setup(s => s.AnyAsync(It.IsAny<Expression<Func<FeatureFlag, bool>>>()))
            .ThrowsAsync(new InvalidOperationException("database down"));

        await f.Sut.BackfillDcAsync("east", ConsistencyMode.BestEffort, f.Snapshot);

        f.Time.Advance(TimeSpan.FromSeconds(61));
        Assert.Equal(["east"], f.Sut.TakeDcsDueForPrune());
    }

    [Fact]
    public async Task PruneDcAsync_ALaterPruneFindsNothingLeftForLater_StopsBeingDue()
    {
        var f = CreatePruneFixture();
        var orphan = Guid.NewGuid();
        f.East.Setup(s => s.GetFlagIndexAsync(f.EnvA)).ReturnsAsync(Index((orphan, RecentScore)));
        await f.Sut.BackfillDcAsync("east", ConsistencyMode.BestEffort, f.Snapshot);
        f.Time.Advance(TimeSpan.FromMinutes(10));

        await f.Sut.PruneDcAsync("east", ConsistencyMode.BestEffort, f.Snapshot);
        f.Time.Advance(TimeSpan.FromDays(1));

        Assert.Empty(f.Sut.TakeDcsDueForPrune());
    }

    [Fact]
    public async Task PruneDcAsync_WhenCompositeCacheUnavailable_ReturnsSkipped()
    {
        var sut = CreateSut(Mock.Of<ICacheService>());

        var result = await sut.PruneDcAsync("east", ConsistencyMode.BestEffort, EmptySnapshot);

        Assert.Equal(IDcBackfiller.Skipped, result);
    }

    [Fact]
    public async Task PruneDcAsync_WhileABackfillOfThatDcIsInFlight_ReturnsSkipped()
    {
        var f = CreatePruneFixture();
        var gate = new TaskCompletionSource();
        f.East.Setup(s => s.UpsertFlagIfNewerAsync(It.IsAny<FeatureFlag>()))
            .Returns(async () =>
            {
                await gate.Task;
                return true;
            });
        var backfill = f.Sut.BackfillDcAsync("east", ConsistencyMode.BestEffort, f.Snapshot);

        var result = await f.Sut.PruneDcAsync("east", ConsistencyMode.BestEffort, f.Snapshot);

        Assert.Equal(IDcBackfiller.Skipped, result);
        gate.SetResult();
        await backfill;
    }

    [Fact]
    public async Task PruneDcAsync_EntriesWereRemoved_PublishesAClientRefreshForThatDc()
    {
        var f = CreatePruneFixture();
        f.East.Setup(s => s.GetFlagIndexAsync(f.EnvA)).ReturnsAsync(Index((Guid.NewGuid(), OldScore)));

        var removed = await f.Sut.PruneDcAsync("east", ConsistencyMode.BestEffort, f.Snapshot);

        Assert.Equal(1, removed);
        _producer.Verify(
            p => p.PublishAsync(
                ControlPlaneTopics.ControlPlaneCommand,
                It.Is<ControlPlaneCommand>(c => c.Action == Domain.Messages.Action.PushFullSync && c.TargetDcId == "east")),
            Times.Once);
    }

    [Fact]
    public async Task PruneDcAsync_NothingWasRemoved_PublishesNoClientRefresh()
    {
        var f = CreatePruneFixture();

        var removed = await f.Sut.PruneDcAsync("east", ConsistencyMode.BestEffort, f.Snapshot);

        Assert.Equal(0, removed);
        _producer.Verify(p => p.PublishAsync(It.IsAny<string>(), It.IsAny<ControlPlaneCommand>()), Times.Never);
    }

    [Fact]
    public async Task BackfillDcAsync_WhileAPruneOfThatDcIsInFlight_IsNotSkipped()
    {
        // A skipped backfill is taken to mean that another backfill is repairing the DC. A prune does not repair
        // what a backfill writes, so it must never make a backfill look like a duplicate.
        var f = CreatePruneFixture();
        var gate = new TaskCompletionSource();
        var calls = 0;
        f.East.Setup(s => s.GetFlagIndexAsync(It.IsAny<Guid>()))
            .Returns(async () =>
            {
                if (Interlocked.Increment(ref calls) == 1)
                {
                    await gate.Task; // the prune is held here
                }

                return Index();
            });
        f.East.Setup(s => s.UpsertFlagIfNewerAsync(It.IsAny<FeatureFlag>())).ReturnsAsync(true);
        var prune = f.Sut.PruneDcAsync("east", ConsistencyMode.BestEffort, f.Snapshot);

        var backfill = await f.Sut.BackfillDcAsync("east", ConsistencyMode.BestEffort, f.Snapshot);

        Assert.NotEqual(IDcBackfiller.Skipped, backfill);
        Assert.Equal(2, backfill); // both live flags were written
        gate.SetResult();
        await prune;
    }

    [Fact]
    public async Task PruneDcAsync_WhileAnotherPruneOfThatDcIsInFlight_ReturnsSkipped()
    {
        var f = CreatePruneFixture();
        var gate = new TaskCompletionSource();
        var calls = 0;
        f.East.Setup(s => s.GetFlagIndexAsync(It.IsAny<Guid>()))
            .Returns(async () =>
            {
                if (Interlocked.Increment(ref calls) == 1)
                {
                    await gate.Task;
                }

                return Index();
            });
        var first = f.Sut.PruneDcAsync("east", ConsistencyMode.BestEffort, f.Snapshot);

        var second = await f.Sut.PruneDcAsync("east", ConsistencyMode.BestEffort, f.Snapshot);

        Assert.Equal(IDcBackfiller.Skipped, second);
        gate.SetResult();
        await first;
    }

    // ----- the Mode setting -----

    [Theory]
    [InlineData("Of")]
    [InlineData("Disabled")]
    [InlineData("5")]
    [InlineData("-1")]
    public async Task BackfillDcAsync_ModeIsNotOneOfTheModes_SwitchesPruningOff(string mode)
    {
        // A typo, or a number that Enum.TryParse would accept as an undefined mode, must not enable deletion.
        var f = CreatePruneFixture(mode: mode);
        f.East.Setup(s => s.GetFlagIndexAsync(f.EnvA)).ReturnsAsync(Index((Guid.NewGuid(), OldScore)));

        await f.Sut.BackfillDcAsync("east", ConsistencyMode.BestEffort, f.Snapshot);

        f.East.Verify(s => s.GetFlagIndexAsync(It.IsAny<Guid>()), Times.Never);
        f.East.Verify(s => s.DeleteFlagAsync(It.IsAny<Guid>(), It.IsAny<Guid>()), Times.Never);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task BackfillDcAsync_ModeIsBlank_DefaultsToOn(string mode)
    {
        var f = CreatePruneFixture(mode: mode);
        var orphan = Guid.NewGuid();
        f.East.Setup(s => s.GetFlagIndexAsync(f.EnvA)).ReturnsAsync(Index((orphan, OldScore)));

        await f.Sut.BackfillDcAsync("east", ConsistencyMode.BestEffort, f.Snapshot);

        f.East.Verify(s => s.DeleteFlagAsync(f.EnvA, orphan), Times.Once);
    }

    [Theory]
    [InlineData("dryrun")]
    [InlineData(" DryRun ")]
    public async Task BackfillDcAsync_ModeIsWrittenLoosely_IsStillUnderstood(string mode)
    {
        var f = CreatePruneFixture(mode: mode);
        f.East.Setup(s => s.GetFlagIndexAsync(f.EnvA)).ReturnsAsync(Index((Guid.NewGuid(), OldScore)));

        await f.Sut.BackfillDcAsync("east", ConsistencyMode.BestEffort, f.Snapshot);

        f.East.Verify(s => s.GetFlagIndexAsync(f.EnvA), Times.Once); // it ran, as a dry run
        f.East.Verify(s => s.DeleteFlagAsync(It.IsAny<Guid>(), It.IsAny<Guid>()), Times.Never);
    }

    // ----- overlapping prunes and stale snapshots -----

    [Fact]
    public async Task BackfillDcAsync_AnEarlierPruneFinishingLast_DoesNotClearWhatALaterRunLeftForLater()
    {
        var f = CreatePruneFixture();
        var gate = new TaskCompletionSource();
        var calls = 0;
        f.East.Setup(s => s.GetFlagIndexAsync(It.IsAny<Guid>()))
            .Returns(async () =>
            {
                if (Interlocked.Increment(ref calls) == 1)
                {
                    await gate.Task; // the earlier prune is held here, and finds nothing
                    return Index();
                }

                return Index((Guid.NewGuid(), RecentScore)); // later runs find a recent entry and leave it for later
            });
        // The earlier prune knows one environment only, so it makes one read: the held one.
        var earlierSnapshot = f.Snapshot with { Flags = [f.Snapshot.Flags[0]] };
        var earlier = f.Sut.PruneDcAsync("east", ConsistencyMode.BestEffort, earlierSnapshot);

        await f.Sut.BackfillDcAsync("east", ConsistencyMode.BestEffort, f.Snapshot);
        gate.SetResult();
        await earlier; // finishes last, with nothing left for later

        f.Time.Advance(TimeSpan.FromMinutes(10));
        Assert.Equal(["east"], f.Sut.TakeDcsDueForPrune());
    }

    [Fact]
    public async Task BackfillDcAsync_AnEarlierPruneWithALaterRetry_DoesNotPushBackASoonerOne()
    {
        var f = CreatePruneFixture();
        var gate = new TaskCompletionSource();
        var calls = 0;
        var tenSecondsOld = Now.AddSeconds(-10).ToUnixTimeMilliseconds();
        f.East.Setup(s => s.GetFlagIndexAsync(It.IsAny<Guid>()))
            .Returns(async () =>
            {
                if (Interlocked.Increment(ref calls) == 1)
                {
                    await gate.Task;
                    return Index((Guid.NewGuid(), tenSecondsOld)); // eligible in about 591 seconds
                }

                return Index((Guid.NewGuid(), RecentScore)); // eligible in about 541 seconds
            });
        var earlierSnapshot = f.Snapshot with { Flags = [f.Snapshot.Flags[0]] };
        var earlier = f.Sut.PruneDcAsync("east", ConsistencyMode.BestEffort, earlierSnapshot);

        await f.Sut.BackfillDcAsync("east", ConsistencyMode.BestEffort, f.Snapshot);
        gate.SetResult();
        await earlier;

        f.Time.Advance(TimeSpan.FromSeconds(545)); // after the later run's retry, before the earlier one's
        Assert.Equal(["east"], f.Sut.TakeDcsDueForPrune());
    }

    // A prune removes an entry's index score along with the entry, and that score is what makes the only-advance
    // guard reject an older write. A backfill whose snapshot was taken before the removal would therefore write the
    // entry back, with the content it had before it was archived. It must not.

    private static FeatureFlag StaleFlag(Guid id, Guid envId)
    {
        var flag = CreateFlag("pruned-and-stale");
        flag.Id = id;
        flag.EnvId = envId;
        return flag;
    }

    [Theory]
    [InlineData(ConsistencyMode.BestEffort)]
    [InlineData(ConsistencyMode.GatedCommit)]
    public async Task BackfillDcAsync_AFlagWasPrunedAfterTheSnapshotWasTaken_IsNotWrittenBack(ConsistencyMode mode)
    {
        var f = CreatePruneFixture();
        var orphan = Guid.NewGuid();
        f.East.Setup(s => s.GetFlagIndexAsync(f.EnvA)).ReturnsAsync(Index((orphan, OldScore)));
        var staleSnapshot = f.Snapshot with
        {
            Flags = [.. f.Snapshot.Flags, StaleFlag(orphan, f.EnvA)],
            TakenAt = Now.AddMinutes(-1) // before the prune below
        };
        await f.Sut.PruneDcAsync("east", mode, f.Snapshot);

        await f.Sut.BackfillDcAsync("east", mode, staleSnapshot);

        f.East.Verify(s => s.UpsertFlagIfNewerAsync(It.Is<FeatureFlag>(x => x.Id == orphan)), Times.Never);
        f.East.Verify(s => s.StageFlagAsync(It.Is<FeatureFlag>(x => x.Id == orphan), It.IsAny<long>()), Times.Never);
        f.East.Verify(s => s.CommitFlagAsync(It.IsAny<Guid>(), orphan.ToString(), It.IsAny<long>()), Times.Never);
    }

    [Fact]
    public async Task BackfillDcAsync_ASnapshotTakenAfterTheFlagWasPruned_WritesItAgain()
    {
        // If the database does have it after all, the next snapshot says so and the entry comes back.
        var f = CreatePruneFixture();
        var orphan = Guid.NewGuid();
        f.East.Setup(s => s.GetFlagIndexAsync(f.EnvA)).ReturnsAsync(Index((orphan, OldScore)));
        await f.Sut.PruneDcAsync("east", ConsistencyMode.BestEffort, f.Snapshot);
        f.Time.Advance(TimeSpan.FromMinutes(1));
        var laterSnapshot = f.Snapshot with
        {
            Flags = [.. f.Snapshot.Flags, StaleFlag(orphan, f.EnvA)],
            TakenAt = Now.AddSeconds(30) // after the prune
        };

        await f.Sut.BackfillDcAsync("east", ConsistencyMode.BestEffort, laterSnapshot);

        f.East.Verify(s => s.UpsertFlagIfNewerAsync(It.Is<FeatureFlag>(x => x.Id == orphan)), Times.Once);
    }

    [Fact]
    public async Task BackfillDcAsync_ASnapshotWithoutATime_IsTakenToBeAsOldAsTheRun_AndWritesWhatWasPrunedBefore()
    {
        var f = CreatePruneFixture();
        var orphan = Guid.NewGuid();
        f.East.Setup(s => s.GetFlagIndexAsync(f.EnvA)).ReturnsAsync(Index((orphan, OldScore)));
        await f.Sut.PruneDcAsync("east", ConsistencyMode.BestEffort, f.Snapshot);
        f.Time.Advance(TimeSpan.FromMinutes(1));
        var untimed = f.Snapshot with { Flags = [.. f.Snapshot.Flags, StaleFlag(orphan, f.EnvA)], TakenAt = null };

        await f.Sut.BackfillDcAsync("east", ConsistencyMode.BestEffort, untimed);

        f.East.Verify(s => s.UpsertFlagIfNewerAsync(It.Is<FeatureFlag>(x => x.Id == orphan)), Times.Once);
    }

    [Fact]
    public async Task BackfillDcAsync_ASegmentWasPrunedAfterTheSnapshotWasTaken_IsNotWrittenBack()
    {
        var f = CreatePruneFixture();
        var orphan = Guid.NewGuid();
        f.East.Setup(s => s.GetSegmentIndexAsync(f.EnvA)).ReturnsAsync(Index((orphan, OldScore)));
        var staleSegment = new Segment { Id = orphan, Key = "pruned-and-stale" };
        var staleSnapshot = f.Snapshot with
        {
            Segments = [staleSegment],
            SegmentEnvIds = new Dictionary<string, ICollection<Guid>> { [orphan.ToString()] = [f.EnvA] },
            TakenAt = Now.AddMinutes(-1)
        };
        await f.Sut.PruneDcAsync("east", ConsistencyMode.BestEffort, f.Snapshot);

        await f.Sut.BackfillDcAsync("east", ConsistencyMode.BestEffort, staleSnapshot);

        f.East.Verify(
            s => s.UpsertSegmentIfNewerAsync(It.IsAny<ICollection<Guid>>(), It.Is<Segment>(x => x.Id == orphan)),
            Times.Never);
    }

    [Fact]
    public async Task BackfillDcAsync_APrunedMarkerOlderThanAnHour_IsForgotten()
    {
        var f = CreatePruneFixture();
        var first = Guid.NewGuid();
        f.East.Setup(s => s.GetFlagIndexAsync(f.EnvA)).ReturnsAsync(Index((first, OldScore)));
        await f.Sut.PruneDcAsync("east", ConsistencyMode.BestEffort, f.Snapshot);

        f.Time.Advance(TimeSpan.FromMinutes(61));
        f.East.Setup(s => s.GetFlagIndexAsync(f.EnvA)).ReturnsAsync(Index((Guid.NewGuid(), OldScore)));
        await f.Sut.PruneDcAsync("east", ConsistencyMode.BestEffort, f.Snapshot); // a later removal drops old markers

        var ancientSnapshot = f.Snapshot with
        {
            Flags = [.. f.Snapshot.Flags, StaleFlag(first, f.EnvA)],
            TakenAt = Now.AddMinutes(-1)
        };
        await f.Sut.BackfillDcAsync("east", ConsistencyMode.BestEffort, ancientSnapshot);

        f.East.Verify(s => s.UpsertFlagIfNewerAsync(It.Is<FeatureFlag>(x => x.Id == first)), Times.Once);
    }

    // ----- a segment listed in several environments -----

    [Fact]
    public async Task BackfillDcAsync_OneSegmentIndexCannotBeRead_RemovesNoSegmentUntilEveryIndexCanBe()
    {
        var f = CreatePruneFixture();
        var orphan = Guid.NewGuid();
        f.East.Setup(s => s.GetSegmentIndexAsync(f.EnvA)).ReturnsAsync(Index((orphan, OldScore)));
        f.East.Setup(s => s.GetSegmentIndexAsync(f.EnvB)).ThrowsAsync(new TimeoutException("redis"));

        await f.Sut.BackfillDcAsync("east", ConsistencyMode.BestEffort, f.Snapshot);

        f.East.Verify(s => s.DeleteSegmentAsync(It.IsAny<ICollection<Guid>>(), It.IsAny<Guid>()), Times.Never);

        // The index can be read a minute later, and the segment is removed from both environments.
        f.East.Setup(s => s.GetSegmentIndexAsync(f.EnvB)).ReturnsAsync(Index((orphan, OldScore)));
        f.Time.Advance(TimeSpan.FromSeconds(61));
        Assert.Equal(["east"], f.Sut.TakeDcsDueForPrune());
        await f.Sut.PruneDcAsync("east", ConsistencyMode.BestEffort, f.Snapshot);

        f.East.Verify(
            s => s.DeleteSegmentAsync(
                It.Is<ICollection<Guid>>(ids => ids.OrderBy(i => i).SequenceEqual(new[] { f.EnvA, f.EnvB }.OrderBy(i => i))),
                orphan),
            Times.Once);
    }

    [Fact]
    public async Task BackfillDcAsync_FlagIndexOfOneEnvironmentCannotBeRead_StillPrunesTheOthers()
    {
        var f = CreatePruneFixture();
        var orphan = Guid.NewGuid();
        f.East.Setup(s => s.GetFlagIndexAsync(f.EnvA)).ThrowsAsync(new TimeoutException("redis"));
        f.East.Setup(s => s.GetFlagIndexAsync(f.EnvB)).ReturnsAsync(Index((orphan, OldScore)));

        await f.Sut.BackfillDcAsync("east", ConsistencyMode.BestEffort, f.Snapshot);

        f.East.Verify(s => s.DeleteFlagAsync(f.EnvB, orphan), Times.Once);
    }

    // ----- which value says whether an entry is archived -----

    [Theory]
    [InlineData(ConsistencyMode.BestEffort)]
    [InlineData(ConsistencyMode.GatedCommit)]
    public async Task BackfillDcAsync_ChecksArchivedStateInTheModeOfTheBackfill(ConsistencyMode mode)
    {
        var f = CreatePruneFixture();
        var orphanFlag = Guid.NewGuid();
        var orphanSegment = Guid.NewGuid();
        f.East.Setup(s => s.GetFlagIndexAsync(f.EnvA)).ReturnsAsync(Index((orphanFlag, OldScore)));
        f.East.Setup(s => s.GetSegmentIndexAsync(f.EnvA)).ReturnsAsync(Index((orphanSegment, OldScore)));

        await f.Sut.BackfillDcAsync("east", mode, f.Snapshot);

        f.East.Verify(s => s.IsFlagArchivedAsync(orphanFlag, mode), Times.Once);
        f.East.Verify(s => s.IsSegmentArchivedAsync(orphanSegment, mode), Times.Once);
    }
}

using Api.Application.ControlPlane;
using Api.Infrastructure.Caches;
using Application.Caches;
using Application.ControlPlane;
using Domain.FeatureFlags;
using Domain.Messages;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
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

    private DcBackfiller CreateSut(ICacheService compositeCache) =>
        new(
            Mock.Of<IServiceScopeFactory>(),
            compositeCache,
            _producer.Object,
            NullLogger<DcBackfiller>.Instance);

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
}

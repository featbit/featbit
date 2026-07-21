using Api.UnitTests.Stubs;
using Api.Application.ControlPlane;
using Application.ControlPlane;
using Domain.ControlPlane;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Testing;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace Api.UnitTests.Application.ControlPlane;

/// <summary>
/// #92 unit-level coverage for <see cref="RecoveryWorker"/>'s honest metrics/logs and hoisted
/// composite-cache guard, against a MOCKED <see cref="IDcBackfiller"/> — the end-to-end backfill
/// behavior itself (real Mongo/Redis) is covered by the acceptance tests in
/// Api.IntegrationTests/ControlPlane/RecoveryWorkerTests.cs.
/// </summary>
public class RecoveryWorkerTests
{
    private readonly Mock<IDcBackfiller> _backfiller = new();
    private readonly Mock<ILeaseStore> _leaseStore = new();

    private static readonly CommittedSnapshot EmptySnapshot = new(
        Array.Empty<Domain.FeatureFlags.FeatureFlag>(),
        Array.Empty<Domain.Segments.Segment>(),
        new Dictionary<string, ICollection<Guid>>(),
        Array.Empty<Domain.Environments.SecretCache>());

    public RecoveryWorkerTests()
    {
        // Default: composite cache available, backfill "succeeds" (flag count irrelevant here).
        _backfiller.Setup(b => b.IsCompositeCacheAvailable).Returns(true);
        _backfiller
            .Setup(b => b.FetchCommittedSnapshotAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(EmptySnapshot);
        _backfiller
            .Setup(b => b.BackfillDcAsync(It.IsAny<string>(), It.IsAny<ConsistencyMode>(), It.IsAny<CommittedSnapshot>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(0);
    }

    private static DcLease Lease(string dcId) => new()
    {
        DcId = dcId,
        Region = dcId,
        LastHeartbeatAt = DateTimeOffset.UtcNow,
        LeaseExpiresAt = DateTimeOffset.UtcNow.AddMinutes(5)
    };

    private RecoveryWorker CreateSut(ILogger<RecoveryWorker>? logger = null, bool isLeader = true)
    {
        var services = new ServiceCollection();
        services.AddTransient(_ => _leaseStore.Object);
        var provider = services.BuildServiceProvider();

        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ControlPlane:ConsistencyMode"] = "GatedCommit"
            })
            .Build();

        return new RecoveryWorker(
            provider.GetRequiredService<IServiceScopeFactory>(),
            _backfiller.Object,
            new FakeLeaderElection(isLeader),
            configuration,
            logger ?? NullLogger<RecoveryWorker>.Instance);
    }

    private void SetLiveSet(params string[] dcIds) =>
        _leaseStore
            .Setup(s => s.GetLiveSetAsync(It.IsAny<DateTimeOffset>()))
            .ReturnsAsync(dcIds.Select(Lease).ToList());

    // ----- #92: honest metrics -----

    [Fact]
    public async Task ReturnedDc_ActuallyBackfilled_IsCounted()
    {
        _backfiller
            .Setup(b => b.BackfillDcAsync("east", It.IsAny<ConsistencyMode>(), It.IsAny<CommittedSnapshot>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(3); // 3 flags actually written

        SetLiveSet("east");
        var sut = CreateSut();

        var backfilled = await sut.RunOnceAsync();

        Assert.Equal(1, backfilled);
    }

    [Fact]
    public async Task ReturnedDc_CoalescedWithAConcurrentBackfill_IsNotCounted()
    {
        // Simulates CacheReconciler (or another RecoveryWorker tick) already backfilling "east" via the
        // SAME shared IDcBackfiller: the call returns Skipped, not a flag count.
        _backfiller
            .Setup(b => b.BackfillDcAsync("east", It.IsAny<ConsistencyMode>(), It.IsAny<CommittedSnapshot>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(IDcBackfiller.Skipped);

        SetLiveSet("east");
        var sut = CreateSut();

        var backfilled = await sut.RunOnceAsync();

        // The DC WAS returned this tick but the actual repair was coalesced elsewhere, so it must NOT
        // be reported as a repair by this tick's return value.
        Assert.Equal(0, backfilled);
    }

    [Fact]
    public async Task MixOfRepairedAndCoalescedDcs_CountsOnlyTheRepairedOnes()
    {
        _backfiller
            .Setup(b => b.BackfillDcAsync("east", It.IsAny<ConsistencyMode>(), It.IsAny<CommittedSnapshot>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);
        _backfiller
            .Setup(b => b.BackfillDcAsync("west", It.IsAny<ConsistencyMode>(), It.IsAny<CommittedSnapshot>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(IDcBackfiller.Skipped);

        SetLiveSet("east", "west");
        var sut = CreateSut();

        var backfilled = await sut.RunOnceAsync();

        Assert.Equal(1, backfilled);
    }

    // ----- #105: a genuinely guard-rejected-all backfill (accepted 0, NOT Skipped) is not a repair -----

    [Fact]
    public async Task ReturnedDc_BackfillRanButGuardAcceptedZero_IsNotCounted()
    {
        // #105: DcBackfiller.BackfillDcAsync now returns the ACCEPTED count, not the attempted
        // count. A DC that ran a full backfill but had every write guard-rejected (its Redis
        // already matched the source of truth for every flag) returns 0 — distinct from
        // IDcBackfiller.Skipped (coalesced), but still not a genuine repair.
        _backfiller
            .Setup(b => b.BackfillDcAsync("east", It.IsAny<ConsistencyMode>(), It.IsAny<CommittedSnapshot>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(0);

        SetLiveSet("east");
        var sut = CreateSut();

        var backfilled = await sut.RunOnceAsync();

        Assert.Equal(0, backfilled);
    }

    [Fact]
    public async Task MixOfAcceptedZeroAndGenuinelyRepairedDcs_CountsOnlyTheGenuinelyRepairedOne()
    {
        _backfiller
            .Setup(b => b.BackfillDcAsync("east", It.IsAny<ConsistencyMode>(), It.IsAny<CommittedSnapshot>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(0); // ran, but guard accepted nothing
        _backfiller
            .Setup(b => b.BackfillDcAsync("west", It.IsAny<ConsistencyMode>(), It.IsAny<CommittedSnapshot>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(2); // genuinely repaired 2 flags

        SetLiveSet("east", "west");
        var sut = CreateSut();

        var backfilled = await sut.RunOnceAsync();

        Assert.Equal(1, backfilled);
    }

    // ----- #92: composite-cache guard hoisted to once per tick -----

    [Fact]
    public async Task CompositeCacheUnavailable_ReturnsZero_LogsOnce_AndNeverFetchesSnapshotOrCallsBackfill()
    {
        _backfiller.Setup(b => b.IsCompositeCacheAvailable).Returns(false);
        var logger = new FakeLogger<RecoveryWorker>();

        SetLiveSet("east", "west"); // two DCs return in the SAME tick
        var sut = CreateSut(logger);

        var backfilled = await sut.RunOnceAsync();

        Assert.Equal(0, backfilled);
        _backfiller.Verify(
            b => b.FetchCommittedSnapshotAsync(It.IsAny<CancellationToken>()),
            Times.Never());
        _backfiller.Verify(
            b => b.BackfillDcAsync(It.IsAny<string>(), It.IsAny<ConsistencyMode>(), It.IsAny<CommittedSnapshot>(), It.IsAny<CancellationToken>()),
            Times.Never());

        // Exactly one warning for the whole tick, even though TWO DCs returned.
        Assert.Single(logger.Collector.GetSnapshot(), x => x.Level == LogLevel.Warning);
    }

    [Fact]
    public async Task CompositeCacheUnavailable_ThenAvailable_RetriesOnNextTick()
    {
        _backfiller.SetupSequence(b => b.IsCompositeCacheAvailable)
            .Returns(false)
            .Returns(true);
        _backfiller
            .Setup(b => b.BackfillDcAsync("east", It.IsAny<ConsistencyMode>(), It.IsAny<CommittedSnapshot>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);

        SetLiveSet("east");
        var sut = CreateSut();

        var first = await sut.RunOnceAsync(); // guard fails -> 0, watermark un-advanced for "east"
        Assert.Equal(0, first);

        var second = await sut.RunOnceAsync(); // "east" re-detected as returned -> guard now passes
        Assert.Equal(1, second);
    }

    // ----- #71b leader gating still short-circuits before the guard/metrics logic -----

    [Fact]
    public async Task NotLeader_ReturnsZero_AndNeverTouchesBackfillerOrLeaseStore()
    {
        SetLiveSet("east");
        var sut = CreateSut(isLeader: false);

        var backfilled = await sut.RunOnceAsync();

        Assert.Equal(0, backfilled);
        _leaseStore.Verify(s => s.GetLiveSetAsync(It.IsAny<DateTimeOffset>()), Times.Never());
        _backfiller.Verify(
            b => b.BackfillDcAsync(It.IsAny<string>(), It.IsAny<ConsistencyMode>(), It.IsAny<CommittedSnapshot>(), It.IsAny<CancellationToken>()),
            Times.Never());
    }
}

using Api.UnitTests.Stubs;
using System.Diagnostics.Metrics;
using Api.Application.ControlPlane;
using Application.ControlPlane;
using Domain.ControlPlane;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace Api.UnitTests.Application.ControlPlane;

public class DcIdConsistencyCheckerTests
{
    [Fact]
    public void Compare_WhenConfiguredDcHasNoReportingLease_ReportsMissingLease()
    {
        // Acceptance: configured {west, east}, leases report {west} -> "east has no reporting lease".
        var configured = new[] { "west", "east" };
        var reporting = new[] { "west" };

        var result = DcIdConsistencyChecker.Compare(configured, reporting);

        Assert.Equal(new[] { "east" }, result.MissingLeases);
        Assert.Empty(result.UnknownDcs);
    }

    [Fact]
    public void Compare_WhenReportingDcIsNotConfigured_ReportsUnknownDc()
    {
        // Acceptance: leases report {west, south}, configured {west} -> "south is an unknown DC".
        var configured = new[] { "west" };
        var reporting = new[] { "west", "south" };

        var result = DcIdConsistencyChecker.Compare(configured, reporting);

        Assert.Empty(result.MissingLeases);
        Assert.Equal(new[] { "south" }, result.UnknownDcs);
    }

    [Fact]
    public void Compare_WhenAllMatch_ReportsNoMismatch()
    {
        // Acceptance: all-match -> no warning.
        var configured = new[] { "west", "east" };
        var reporting = new[] { "east", "west" };

        var result = DcIdConsistencyChecker.Compare(configured, reporting);

        Assert.Empty(result.MissingLeases);
        Assert.Empty(result.UnknownDcs);
        Assert.False(result.HasMismatch);
    }

    [Fact]
    public void Compare_IsCaseSensitiveAndOrdinal_MatchingLeaseStoreDcIdSemantics()
    {
        // Lease DcIds are compared ordinally elsewhere (HashSet<string> default), so a case
        // difference is a genuine mismatch (a likely typo), surfaced on both sides.
        var configured = new[] { "West" };
        var reporting = new[] { "west" };

        var result = DcIdConsistencyChecker.Compare(configured, reporting);

        Assert.Equal(new[] { "West" }, result.MissingLeases);
        Assert.Equal(new[] { "west" }, result.UnknownDcs);
        Assert.True(result.HasMismatch);
    }

    [Fact]
    public void Compare_IgnoresEmptyOrWhitespaceConfiguredDcIds()
    {
        // Empty/ordinal-fallback configured DcIds carry no operator-meaningful identity, so they
        // are excluded from the comparison rather than reported as missing leases.
        var configured = new[] { "west", "", "  " };
        var reporting = new[] { "west" };

        var result = DcIdConsistencyChecker.Compare(configured, reporting);

        Assert.Empty(result.MissingLeases);
        Assert.Empty(result.UnknownDcs);
    }

    [Fact]
    public void Compare_DeduplicatesAndSortsForStableMessages()
    {
        var configured = new[] { "east", "west", "east" };
        var reporting = new[] { "north", "south", "north" };

        var result = DcIdConsistencyChecker.Compare(configured, reporting);

        // both configured DcIds lack a reporting lease, sorted for stable log output
        Assert.Equal(new[] { "east", "west" }, result.MissingLeases);
        // both reporting DcIds are unknown, sorted
        Assert.Equal(new[] { "north", "south" }, result.UnknownDcs);
    }

    // ----- #71b leader gating -----

    /// <summary>
    /// Minimal construction of the worker itself (not just the static <see cref="DcIdConsistencyChecker.Compare"/>
    /// helper the rest of this file exercises): an in-memory <see cref="IConfiguration"/> and a
    /// scope factory resolving a mocked <see cref="ILeaseStore"/>, matching how DI wires the real
    /// worker via <c>IServiceScopeFactory</c>.
    /// </summary>
    [Fact]
    public async Task RunOnceAsync_WhenNotLeader_ReturnsNull_WithoutTouchingLeaseStore()
    {
        var leaseStore = new Mock<ILeaseStore>();
        var services = new ServiceCollection();
        services.AddTransient(_ => leaseStore.Object);
        var provider = services.BuildServiceProvider();

        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ControlPlane:ConsistencyMode"] = "GatedCommit"
            })
            .Build();

        var sut = new DcIdConsistencyChecker(
            provider.GetRequiredService<IServiceScopeFactory>(),
            configuration,
            new FakeLeaderElection(isLeader: false),
            NullLogger<DcIdConsistencyChecker>.Instance);

        var result = await sut.RunOnceAsync();

        Assert.Null(result);
        leaseStore.Verify(x => x.GetLiveSetAsync(It.IsAny<DateTimeOffset>()), Times.Never);
    }

    // ----- #105: non-leader gauge freeze -----

    /// <summary>
    /// #105: the unmatched-DC gauge (<see cref="DcIdConsistencyChecker.UnmatchedDcCountGaugeName"/>)
    /// is backed by static fields refreshed only on a leader tick, with no leader filter in the
    /// ObservableGauge callback itself — so a former leader that loses leadership would otherwise
    /// keep exporting its stale last-leader snapshot forever. A leader tick with a genuine mismatch
    /// sets the gauge non-zero; the very next tick as a NON-leader must zero it, not leave it stale.
    /// </summary>
    [Fact]
    public async Task RunOnceAsync_WhenLeadershipIsLost_ZeroesTheUnmatchedDcGauge()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ControlPlane:ConsistencyMode"] = "GatedCommit",
                ["Redis:Instances:0:DcId"] = "west",
                ["Redis:Instances:1:DcId"] = "east"
            })
            .Build();

        // Only "west" reports a lease -> "east" is MissingLeases, and the reporting DC "south" is an
        // UnknownDc: a genuine, non-zero mismatch on the leader tick.
        var leaseStore = new Mock<ILeaseStore>();
        leaseStore.Setup(x => x.GetLiveSetAsync(It.IsAny<DateTimeOffset>())).ReturnsAsync(
        [
            new DcLease { DcId = "west", Region = "west", LastHeartbeatAt = DateTimeOffset.UtcNow, LeaseExpiresAt = DateTimeOffset.UtcNow.AddMinutes(5) },
            new DcLease { DcId = "south", Region = "south", LastHeartbeatAt = DateTimeOffset.UtcNow, LeaseExpiresAt = DateTimeOffset.UtcNow.AddMinutes(5) }
        ]);

        var services = new ServiceCollection();
        services.AddTransient(_ => leaseStore.Object);
        var provider = services.BuildServiceProvider();

        var leaderSut = new DcIdConsistencyChecker(
            provider.GetRequiredService<IServiceScopeFactory>(),
            configuration,
            new FakeLeaderElection(isLeader: true),
            NullLogger<DcIdConsistencyChecker>.Instance);

        var leaderResult = await leaderSut.RunOnceAsync();
        Assert.NotNull(leaderResult);
        Assert.True(leaderResult!.HasMismatch);

        var (missingBefore, unknownBefore) = ReadUnmatchedDcGauge();
        Assert.Equal(1, missingBefore); // "east"
        Assert.Equal(1, unknownBefore); // "south"

        // Same static gauge fields; a different instance (as DI would create per-tick) now runs as
        // NON-leader — the gauge must be zeroed, not left at the former leader's stale snapshot.
        var nonLeaderSut = new DcIdConsistencyChecker(
            provider.GetRequiredService<IServiceScopeFactory>(),
            configuration,
            new FakeLeaderElection(isLeader: false),
            NullLogger<DcIdConsistencyChecker>.Instance);

        var nonLeaderResult = await nonLeaderSut.RunOnceAsync();
        Assert.Null(nonLeaderResult);

        var (missingAfter, unknownAfter) = ReadUnmatchedDcGauge();
        Assert.Equal(0, missingAfter);
        Assert.Equal(0, unknownAfter);
    }

    /// <summary>
    /// Forces a single read of the observable unmatched-DC-count gauge and returns
    /// (missing_lease, unknown_dc). Mirrors <c>ConsistencyMetricsTests.ReadBacklogGauge</c>'s
    /// on-demand-read pattern via a short-lived <see cref="MeterListener"/>.
    /// </summary>
    private static (long MissingLease, long UnknownDc) ReadUnmatchedDcGauge()
    {
        long missingLease = 0;
        long unknownDc = 0;

        using var listener = new MeterListener
        {
            InstrumentPublished = (instrument, l) =>
            {
                if (instrument.Meter.Name == CommitCoordinatorWorker.MeterName
                    && instrument.Name == DcIdConsistencyChecker.UnmatchedDcCountGaugeName)
                {
                    l.EnableMeasurementEvents(instrument);
                }
            }
        };

        listener.SetMeasurementEventCallback<long>((_, measurement, tags, _) =>
        {
            foreach (var tag in tags)
            {
                if (tag.Key != "direction")
                {
                    continue;
                }

                if ((string?)tag.Value == "missing_lease")
                {
                    missingLease = measurement;
                }
                else if ((string?)tag.Value == "unknown_dc")
                {
                    unknownDc = measurement;
                }
            }
        });

        listener.Start();
        listener.RecordObservableInstruments();

        return (missingLease, unknownDc);
    }
}

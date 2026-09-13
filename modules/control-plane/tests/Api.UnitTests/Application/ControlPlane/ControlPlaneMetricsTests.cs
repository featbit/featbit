using Api.Application.ControlPlane;
using Domain.Observability;

namespace Api.UnitTests.Application.ControlPlane;

/// <summary>
/// Behavioral tests for <see cref="ControlPlaneMetrics"/>.
/// </summary>
/// <remarks>
/// These assert the distinctions the control plane's failure modes depend on: a swallowed handler
/// failure being counted at all, a per-DC fan-out failure being attributable to its DC, and
/// <c>error_demoted</c> being separable from <c>lost</c>. Each of those is a different incident with
/// a different cause, so collapsing any of them would make the metric unable to answer the question
/// it exists for.
/// </remarks>
[Collection(ObservabilityCollection.Name)]
public class ControlPlaneMetricsTests
{
    private static ControlPlaneMetrics Metrics => ControlPlaneMetrics.Current;

    [Fact]
    public void RecordSuppressedFailure_ForOneFailure_TagsTheHandlerAndReason()
    {
        using var collector = new MetricCollector(Metrics.Meter);

        Metrics.RecordSuppressedFailure(
            HandlerNames.Heartbeat, SuppressedFailureReasons.DeserializationFailed);

        var measurement = Assert.Single(collector.For("handler.suppressed_failures"));

        Assert.Equal(1, measurement.Value);
        Assert.Equal(HandlerNames.Heartbeat, measurement.Tag(ObservabilityTags.Operation));
        Assert.Equal(
            SuppressedFailureReasons.DeserializationFailed,
            measurement.Tag(ObservabilityTags.Reason));
    }

    [Fact]
    public void RecordSuppressedFailure_AcrossSeveralHandlers_CountsEachSeparately()
    {
        using var collector = new MetricCollector(Metrics.Meter);

        Metrics.RecordSuppressedFailure(
            HandlerNames.ClientConnectionMade, SuppressedFailureReasons.ValidationFailed);
        Metrics.RecordSuppressedFailure(
            HandlerNames.ClientConnectionClosed, SuppressedFailureReasons.ValidationFailed);

        var handlers = collector.For("handler.suppressed_failures")
            .Select(m => m.Tag(ObservabilityTags.Operation))
            .ToArray();

        // The three swallowing handlers each own a different code path; one of them failing while
        // the others are fine is the normal case, so they must not merge into a single series.
        Assert.Contains(HandlerNames.ClientConnectionMade, handlers);
        Assert.Contains(HandlerNames.ClientConnectionClosed, handlers);
    }

    [Fact]
    public void BroadcastScope_DisposedWithoutAnOutcome_RecordsFailure()
    {
        using var collector = new MetricCollector(Metrics.Meter);

        // Simulates the fan-out throwing before it can mark itself succeeded.
        using (Metrics.BeginBroadcast("dc-fail-closed", "set"))
        {
        }

        var operation = Assert.Single(collector.For("cache.broadcast_operations"), m => (string?)m.Tag(ObservabilityTags.DcId) == "dc-fail-closed");

        Assert.Equal(Outcomes.Failure, operation.Tag(ObservabilityTags.Outcome));
    }

    [Fact]
    public void BroadcastScope_ForOneBroadcast_RecordsACountAndADurationWithTheSameTags()
    {
        using var collector = new MetricCollector(Metrics.Meter);

        using (var scope = Metrics.BeginBroadcast("dc-parity", "set"))
        {
            scope.Succeeded();
        }

        var operation = Assert.Single(collector.For("cache.broadcast_operations"), m => (string?)m.Tag(ObservabilityTags.DcId) == "dc-parity");
        var duration = Assert.Single(collector.For("cache.broadcast_duration"), m => (string?)m.Tag(ObservabilityTags.DcId) == "dc-parity");

        // Rate and latency have to be joinable on the same tag set, or "which DC is slow?" cannot be
        // answered from "which DC is failing?".
        Assert.True(duration.HasTags(
            (ObservabilityTags.DcId, "dc-parity"),
            (ObservabilityTags.Operation, "set"),
            (ObservabilityTags.Outcome, Outcomes.Success)));
        Assert.Equal(Outcomes.Success, operation.Tag(ObservabilityTags.Outcome));
        Assert.Equal("ms", duration.Unit);
    }

    [Fact]
    public void BroadcastScope_DisposedTwice_RecordsOnce()
    {
        using var collector = new MetricCollector(Metrics.Meter);

        var scope = Metrics.BeginBroadcast("dc-idempotent", "set");
        scope.Succeeded();
        scope.Dispose();
        scope.Dispose();

        Assert.Single(collector.For("cache.broadcast_operations"), m => (string?)m.Tag(ObservabilityTags.DcId) == "dc-idempotent");
    }

    [Fact]
    public void RecordBroadcast_AcrossSeveralDcs_KeepsEachOnItsOwnSeries()
    {
        using var collector = new MetricCollector(Metrics.Meter);

        Metrics.RecordBroadcast("dc-west", "set", Outcomes.Success, TimeSpan.FromMilliseconds(2));
        Metrics.RecordBroadcast("dc-east", "set", Outcomes.Failure, TimeSpan.FromMilliseconds(9));

        var west = Assert.Single(collector.For("cache.broadcast_operations"), m => (string?)m.Tag(ObservabilityTags.DcId) == "dc-west");
        var east = Assert.Single(collector.For("cache.broadcast_operations"), m => (string?)m.Tag(ObservabilityTags.DcId) == "dc-east");

        // The whole point of the per-DC tag: the composite cache swallows a single DC's failure so
        // that the others still get the write, which means an aggregate counter would show success.
        Assert.Equal(Outcomes.Success, west.Tag(ObservabilityTags.Outcome));
        Assert.Equal(Outcomes.Failure, east.Tag(ObservabilityTags.Outcome));
    }

    [Fact]
    public void RecordLeaderTransition_ForAnErrorDemotion_KeepsItSeparateFromALostLease()
    {
        using var collector = new MetricCollector(Metrics.Meter);

        Metrics.RecordLeaderTransition(LeaderTransitionKinds.Lost);
        Metrics.RecordLeaderTransition(LeaderTransitionKinds.ErrorDemoted);

        var transitions = collector.For("leader.transitions")
            .Select(m => m.Tag(ObservabilityTags.Reason))
            .ToArray();

        // 'lost' means another instance holds the lease. 'error_demoted' means this instance gave up
        // on a Redis error and may STILL hold it — so the cluster can have no acting leader at all.
        // Collapsing them would hide that second, worse case.
        Assert.Contains(LeaderTransitionKinds.Lost, transitions);
        Assert.Contains(LeaderTransitionKinds.ErrorDemoted, transitions);
    }

    [Theory]
    [InlineData(LeaderTransitionKinds.Acquired)]
    [InlineData(LeaderTransitionKinds.Lost)]
    [InlineData(LeaderTransitionKinds.Released)]
    [InlineData(LeaderTransitionKinds.ErrorDemoted)]
    public void RecordLeaderTransition_ForAnyTransition_CarriesNoInstanceIdentifier(string transition)
    {
        using var collector = new MetricCollector(Metrics.Meter);

        Metrics.RecordLeaderTransition(transition);

        var measurement = Assert.Single(collector.For("leader.transitions"), m => (string?)m.Tag(ObservabilityTags.Reason) == transition);

        // P2 removed instance_id estate-wide; it is redundant with the OTel resource attribute
        // service.instance.id and is unbounded in a scaled deployment.
        Assert.DoesNotContain("instance_id", measurement.Tags.Keys);
    }

    [Fact]
    public void RecordPodEviction_ForAnUnparseablePodId_SeparatesItFromAStaleHeartbeat()
    {
        using var collector = new MetricCollector(Metrics.Meter);

        Metrics.RecordPodEviction(PodEvictionReasons.HeartbeatTimeout, Outcomes.Success);
        Metrics.RecordPodEviction(PodEvictionReasons.InvalidPodId, Outcomes.Failure);

        var timeout = Assert.Single(collector.For("pod_health.evictions"), m =>
                    (string?)m.Tag(ObservabilityTags.Reason) == PodEvictionReasons.HeartbeatTimeout);
        var invalid = Assert.Single(collector.For("pod_health.evictions"), m =>
                    (string?)m.Tag(ObservabilityTags.Reason) == PodEvictionReasons.InvalidPodId);

        // A pod with an unparseable id is never evicted, so it accumulates forever. That is a
        // different problem from a pod that timed out and was cleaned up correctly.
        Assert.Equal(Outcomes.Success, timeout.Tag(ObservabilityTags.Outcome));
        Assert.Equal(Outcomes.Failure, invalid.Tag(ObservabilityTags.Outcome));
    }

    [Fact]
    public void RecordDcBackfill_ForACoalescedBackfill_DistinguishesItFromNoChange()
    {
        using var collector = new MetricCollector(Metrics.Meter);

        Metrics.RecordDcBackfill("dc-backfill", BackfillOutcomes.Coalesced);
        Metrics.RecordDcBackfill("dc-backfill", BackfillOutcomes.NoChange);
        Metrics.RecordDcBackfill("dc-backfill", BackfillOutcomes.Repaired);

        var outcomes = collector.For("recovery.dc_backfills")
            .Where(m => (string?)m.Tag(ObservabilityTags.DcId) == "dc-backfill")
            .Select(m => m.Tag(ObservabilityTags.Outcome))
            .ToArray();

        // 'coalesced' means the work merged with one already in flight — not a failure, and not a
        // clean DC either. Reading it as either would misdirect an investigation.
        Assert.Contains(BackfillOutcomes.Coalesced, outcomes);
        Assert.Contains(BackfillOutcomes.NoChange, outcomes);
        Assert.Contains(BackfillOutcomes.Repaired, outcomes);
    }

    [Fact]
    public void Instruments_AcrossTheWholeModule_UseTheFeatBitPrefix()
    {
        using var collector = new MetricCollector(Metrics.Meter);

        Metrics.RecordSuppressedFailure(HandlerNames.Heartbeat, SuppressedFailureReasons.Unhandled);
        Metrics.RecordBroadcast("dc-prefix", "set", Outcomes.Success, TimeSpan.FromMilliseconds(1));
        Metrics.RecordLeaderTransition(LeaderTransitionKinds.Acquired);
        Metrics.RecordPodEviction(PodEvictionReasons.HeartbeatTimeout, Outcomes.Success);
        Metrics.RecordDcBackfill("dc-prefix", BackfillOutcomes.Repaired);

        Assert.NotEmpty(collector.Measurements);
        Assert.DoesNotContain(
            collector.Measurements,
            m => !m.InstrumentName.StartsWith(FeatBitInstruments.ControlPlanePrefix, StringComparison.Ordinal));
    }

    [Fact]
    public void Instruments_AcrossTheWholeModule_CarryNoBannedAttribute()
    {
        using var collector = new MetricCollector(Metrics.Meter);

        Metrics.RecordSuppressedFailure(HandlerNames.Heartbeat, SuppressedFailureReasons.Unhandled);
        Metrics.RecordBroadcast("dc-budget", "set", Outcomes.Failure, TimeSpan.FromMilliseconds(1));
        Metrics.RecordLeaderTransition(LeaderTransitionKinds.ErrorDemoted);
        Metrics.RecordPodEviction(PodEvictionReasons.InvalidPodId, Outcomes.Failure);
        Metrics.RecordDcBackfill("dc-budget", BackfillOutcomes.NoChange);

        string[] banned = ["env_id", "instance_id", "pod_id", "flag_key", "user_id", "url", "token"];

        var offenders = collector.Measurements
            .SelectMany(m => m.Tags.Keys)
            .Where(key => banned.Contains(key, StringComparer.Ordinal))
            .Distinct()
            .ToArray();

        Assert.Empty(offenders);
    }
}

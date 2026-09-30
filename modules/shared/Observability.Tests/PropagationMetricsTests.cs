using System.Diagnostics;
using Domain.Observability;

namespace FeatBit.Observability.Tests;

/// <summary>
/// Behavior of the M3 propagation instruments and the T1 spans they carry.
/// </summary>
/// <remarks>
/// These tests pin the two decisions that are easiest to get wrong later: that a partly-successful
/// fan-out is its own outcome rather than being collapsed into success or failure, and that the T1
/// span is not created at all while tracing is disabled.
/// </remarks>
[Collection(ObservabilityCollection.Name)]
public sealed class PropagationMetricsTests : IDisposable
{
    private readonly TraceGate _originalGate = TraceGate.Current;

    public void Dispose() => TraceGate.SetCurrent(_originalGate);

    [Fact]
    public void StageScope_Succeeded_RecordsStageAndDurationWithMatchingTags()
    {
        var metrics = PropagationMetrics.Current;
        using var collector = new MetricCollector(metrics.Meter);

        using (var scope = metrics.BeginStage(ChangeId.FlagResource, PropagationStages.Persist))
        {
            scope.Succeeded();
        }

        var stage = Single(collector, "propagation.stages", PropagationStages.Persist);
        var duration = Single(collector, "propagation.stage_duration", PropagationStages.Persist);

        Assert.Equal(1, stage.Value);
        Assert.Equal(Outcomes.Success, stage.Tag(ObservabilityTags.Outcome));
        Assert.Equal(ChangeId.FlagResource, stage.Tag(ObservabilityTags.ResourceType));
        Assert.Equal(stage.Tags, duration.Tags);
        Assert.Equal("ms", duration.Unit);
    }

    [Fact]
    public void StageScope_NoOutcomeReported_RecordsFailure()
    {
        var metrics = PropagationMetrics.Current;
        using var collector = new MetricCollector(metrics.Meter);

        using (metrics.BeginStage(ChangeId.FlagResource, PropagationStages.Publish))
        {
        }

        Assert.Equal(
            Outcomes.Failure,
            Single(collector, "propagation.stages", PropagationStages.Publish).Tag(ObservabilityTags.Outcome));
    }

    /// <summary>
    /// A fan-out that reached most connections but not all is neither a success nor an outage.
    /// Collapsing it into either loses the only case worth paging about, so <c>partial</c> is a
    /// distinct outcome value.
    /// </summary>
    [Fact]
    public void StageScope_Partial_IsDistinctFromSuccessAndFailure()
    {
        var metrics = PropagationMetrics.Current;
        using var collector = new MetricCollector(metrics.Meter);

        using (var scope = metrics.RecordFanout(ChangeId.SegmentResource))
        {
            scope.Partial();
        }

        var outcome = Single(collector, "propagation.stages", PropagationStages.Fanout)
            .Tag(ObservabilityTags.Outcome);

        Assert.Equal(PropagationStages.PartialOutcome, outcome);
        Assert.NotEqual(Outcomes.Success, outcome);
        Assert.NotEqual(Outcomes.Failure, outcome);
    }

    [Fact]
    public void RecordFanout_ForAChange_TagsTheFanoutStage()
    {
        var metrics = PropagationMetrics.Current;
        using var collector = new MetricCollector(metrics.Meter);

        using (var scope = metrics.RecordFanout(ChangeId.FlagResource))
        {
            scope.Succeeded();
        }

        Assert.Contains(collector.For("propagation.stages"),
            m => m.Tag(ObservabilityTags.Stage) == PropagationStages.Fanout);
    }

    /// <summary>
    /// Deliveries are counted per connection but the stage is timed once per change. A histogram
    /// recorded per connection would measure fan-out WIDTH rather than latency — a change reaching
    /// ten thousand connections quickly would look far worse than one reaching ten slowly.
    /// </summary>
    [Fact]
    public void RecordDelivery_ForManyConnections_CountsEachWithoutTimingThem()
    {
        var metrics = PropagationMetrics.Current;
        using var collector = new MetricCollector(metrics.Meter);

        using (var scope = metrics.RecordFanout(ChangeId.FlagResource))
        {
            metrics.RecordDelivery(ChangeId.FlagResource, Outcomes.Success);
            metrics.RecordDelivery(ChangeId.FlagResource, Outcomes.Success);
            metrics.RecordDelivery(ChangeId.FlagResource, Outcomes.Failure);
            scope.Partial();
        }

        var deliveries = collector.For("propagation.deliveries");
        var fanoutDurations = collector.For("propagation.stage_duration")
            .Where(m => m.Tag(ObservabilityTags.Stage) == PropagationStages.Fanout)
            .ToArray();

        Assert.Equal(3, deliveries.Count);
        Assert.Equal(2, deliveries.Count(m => m.Tag(ObservabilityTags.Outcome) == Outcomes.Success));
        Assert.Single(fanoutDurations);
    }

    /// <summary>
    /// Custom traces default to off, and the gate is checked BEFORE the span is created — not after,
    /// and not by creating a span and discarding it. A disabled category must cost a hash lookup.
    /// </summary>
    [Fact]
    public void StageScope_WithTracingDisabled_CreatesNoActivity()
    {
        TraceGate.SetCurrent(TraceGate.Disabled);

        using var listener = ListenToServiceSource(out var started);

        using (var scope = PropagationMetrics.Current.BeginStage(
                   ChangeId.FlagResource, PropagationStages.Persist))
        {
            scope.Succeeded();
        }

        Assert.Empty(started);
    }

    [Fact]
    public void StageScope_WithTracingEnabled_CreatesASpanTaggedWithStageAndOutcome()
    {
        TraceGate.SetCurrent(new TraceGate([TraceCategories.FlagChange], 1d));

        using var listener = ListenToServiceSource(out var started);

        using (var scope = PropagationMetrics.Current.BeginStage(
                   ChangeId.FlagResource, PropagationStages.Persist))
        {
            scope.Succeeded();
        }

        var activity = Assert.Single(started);

        Assert.Equal($"{ChangeId.FlagResource}.{PropagationStages.Persist}", activity.OperationName);
        Assert.Equal(ChangeId.FlagResource, activity.GetTagItem(ObservabilityTags.ResourceType));
        Assert.Equal(PropagationStages.Persist, activity.GetTagItem(ObservabilityTags.Stage));
        Assert.Equal(Outcomes.Success, activity.GetTagItem(ObservabilityTags.Outcome));
        Assert.Equal(ActivityStatusCode.Ok, activity.Status);
    }

    [Fact]
    public void StageScope_FailedStage_MarksTheSpanAsError()
    {
        TraceGate.SetCurrent(new TraceGate([TraceCategories.FlagChange], 1d));

        using var listener = ListenToServiceSource(out var started);

        using (PropagationMetrics.Current.BeginStage(ChangeId.FlagResource, PropagationStages.Publish))
        {
        }

        Assert.Equal(ActivityStatusCode.Error, Assert.Single(started).Status);
    }

    /// <summary>
    /// One aggregate span carries the fan-out width. Per-connection spans would multiply trace
    /// volume by the connection count and answer exactly the same question.
    /// </summary>
    [Fact]
    public void SetFanoutCounts_ForAFanout_RecordsWidthOnTheAggregateSpan()
    {
        TraceGate.SetCurrent(new TraceGate([TraceCategories.FlagChange], 1d));

        using var listener = ListenToServiceSource(out var started);

        using (var scope = PropagationMetrics.Current.RecordFanout(ChangeId.FlagResource))
        {
            scope.Succeeded();
            scope.SetFanoutCounts(targeted: 1200, failed: 3);
        }

        var activity = Assert.Single(started);

        Assert.Equal(1200, activity.GetTagItem("fanout.targeted"));
        Assert.Equal(3, activity.GetTagItem("fanout.failed"));
    }

    [Fact]
    public void SetFanoutCounts_WithTracingDisabled_IsANoOp()
    {
        TraceGate.SetCurrent(TraceGate.Disabled);

        var metrics = PropagationMetrics.Current;
        using var collector = new MetricCollector(metrics.Meter);

        using (var scope = metrics.RecordFanout(ChangeId.FlagResource))
        {
            scope.Succeeded();
            scope.SetFanoutCounts(targeted: 5, failed: 0);
        }

        // The metric must still be recorded even though there is no span to annotate.
        Assert.Contains(collector.For("propagation.stages"),
            m => m.Tag(ObservabilityTags.Stage) == PropagationStages.Fanout);
    }

    private static ActivityListener ListenToServiceSource(out List<Activity> started)
    {
        var collected = new List<Activity>();
        started = collected;

        // The source name is resolved BEFORE the listener is registered, and the lambda closes over
        // the resolved string rather than reading the static again. ActivitySource's constructor
        // notifies every registered listener, so a ShouldListenTo that touches
        // FeatBitActivitySources re-enters that type's initializer while it is still running and
        // throws a TypeInitializationException that poisons the type for the rest of the process.
        var sourceName = FeatBitActivitySources.Service.Name;

        var listener = new ActivityListener
        {
            ShouldListenTo = source => source.Name == sourceName,
            Sample = (ref ActivityCreationOptions<ActivityContext> _) => ActivitySamplingResult.AllData,

            // Only stage spans are collected. The service source is shared with ingress activities,
            // and test classes run in parallel, so listening indiscriminately would let another
            // class's spans leak into these assertions.
            ActivityStopped = activity =>
            {
                if (activity.GetTagItem(ObservabilityTags.Stage) is not null)
                {
                    lock (collected)
                    {
                        collected.Add(activity);
                    }
                }
            }
        };

        ActivitySource.AddActivityListener(listener);

        return listener;
    }

    private static RecordedMeasurement Single(MetricCollector collector, string name, string stage)
        => Assert.Single(collector.For(name), m => m.Tag(ObservabilityTags.Stage) == stage);
}

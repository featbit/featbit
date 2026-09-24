#nullable enable

using System.Diagnostics;
using System.Diagnostics.Metrics;

namespace Domain.Observability;

/// <summary>
/// M3 — per-stage instrumentation for a flag or segment change as it propagates through this
/// service.
/// </summary>
/// <remarks>
/// <para>
/// <b>Each service measures its own stages, not end-to-end latency.</b> True end-to-end propagation
/// time needs trace context carried across the message queue, which is a wire-format change
/// (follow-up F1). Until then, stage timings measured independently in each service still answer
/// the question that matters during an incident — <i>where</i> a change stopped moving — because a
/// stalled stage shows a rising duration or a falling rate while its neighbors look normal.
/// </para>
/// <para>
/// <b>Fan-out is counted per delivery, but timed per change.</b> A single flag change can fan out
/// to thousands of connections. Recording a duration per connection would produce a histogram
/// dominated by fan-out width rather than by latency, so <see cref="RecordFanout"/> times the whole
/// fan-out once and <see cref="RecordDelivery"/> counts each connection's outcome. The ratio of
/// failed to total deliveries is what identifies a partial fan-out — the failure mode that is
/// otherwise invisible, because the loop catches per-connection exceptions and continues.
/// </para>
/// <para>
/// Attributes are limited to <c>resource_type</c> (flag or segment), <c>stage</c>, and
/// <c>outcome</c>. The flag key, environment id, and change id are deliberately never recorded as
/// attributes — they are unbounded and are banned by the cardinality budget
/// (<c>docs/observability/index.md</c> §4). The change id lives on the activity and in logs
/// instead, which is where per-change lookup belongs.
/// </para>
/// </remarks>
public sealed class PropagationMetrics
{
    private static PropagationMetrics _current =
        new(new Meter(FeatBitMeters.Api), FeatBitInstruments.ApiPrefix);

    private PropagationMetrics(Meter meter, string instrumentPrefix)
    {
        Meter = meter;

        Stages = meter.CreateCounter<long>(
            $"{instrumentPrefix}propagation.stages",
            unit: "{stage}",
            description:
            "Flag/segment change propagation stages completed in this service, by resource_type, " +
            "stage, and outcome.");

        StageDuration = meter.CreateHistogram<double>(
            $"{instrumentPrefix}propagation.stage_duration",
            unit: "ms",
            description:
            "Duration of one propagation stage in this service, by resource_type, stage, and outcome.");

        Deliveries = meter.CreateCounter<long>(
            $"{instrumentPrefix}propagation.deliveries",
            unit: "{delivery}",
            description:
            "Per-connection sends during a change fan-out, by resource_type and outcome. A nonzero " +
            "failure rate means some clients silently did not receive the change.");
    }

    /// <summary>The instrumentation in use for the running service.</summary>
    public static PropagationMetrics Current => _current;

    /// <summary>The owning meter. Exposed so tests can listen to this instance specifically.</summary>
    public Meter Meter { get; }

    /// <summary>Counter of completed propagation stages.</summary>
    public Counter<long> Stages { get; }

    /// <summary>Distribution of propagation-stage durations.</summary>
    public Histogram<double> StageDuration { get; }

    /// <summary>Counter of per-connection fan-out deliveries.</summary>
    public Counter<long> Deliveries { get; }

    /// <summary>
    /// Points propagation instrumentation at <paramref name="meterName"/> and
    /// <paramref name="instrumentPrefix"/>. Call once during startup, before any change is handled.
    /// </summary>
    /// <remarks>
    /// Required because the back-end's <c>Domain</c> assembly is shared by two hosts: without this
    /// the control plane would publish under <c>featbit.api.*</c> and be misattributed to the API.
    /// </remarks>
    public static void Configure(string meterName, string instrumentPrefix)
    {
        if (string.IsNullOrWhiteSpace(meterName) || string.IsNullOrWhiteSpace(instrumentPrefix))
        {
            return;
        }

        if (meterName == _current.Meter.Name)
        {
            return;
        }

        var previous = _current;
        _current = new PropagationMetrics(new Meter(meterName), instrumentPrefix);
        previous.Meter.Dispose();
    }

    /// <summary>Records a completed propagation stage.</summary>
    /// <param name="resourceType">
    /// <see cref="ChangeId.FlagResource"/> or <see cref="ChangeId.SegmentResource"/>.
    /// </param>
    /// <param name="stage">A value from <see cref="PropagationStages"/>.</param>
    /// <param name="outcome">A value from <see cref="Outcomes"/>.</param>
    /// <param name="duration">How long the stage took.</param>
    public void RecordStage(string resourceType, string stage, string outcome, TimeSpan duration)
    {
        var tags = new TagList
        {
            { ObservabilityTags.ResourceType, resourceType },
            { ObservabilityTags.Stage, stage },
            { ObservabilityTags.Outcome, outcome }
        };

        Stages.Add(1, tags);
        StageDuration.Record(duration.TotalMilliseconds, tags);
    }

    /// <summary>Records the outcome of one connection's send during a fan-out.</summary>
    public void RecordDelivery(string resourceType, string outcome)
        => Deliveries.Add(
            1,
            new KeyValuePair<string, object?>(ObservabilityTags.ResourceType, resourceType),
            new KeyValuePair<string, object?>(ObservabilityTags.Outcome, outcome));

    /// <summary>Times one propagation stage.</summary>
    public StageScope BeginStage(string resourceType, string stage) => new(this, resourceType, stage);

    /// <summary>Times one whole fan-out. Equivalent to <c>BeginStage(resourceType, Fanout)</c>.</summary>
    public StageScope RecordFanout(string resourceType)
        => new(this, resourceType, PropagationStages.Fanout);

    /// <summary>Times one propagation stage. Created by <see cref="BeginStage"/>.</summary>
    public struct StageScope : IDisposable
    {
        private readonly PropagationMetrics _owner;
        private readonly string _resourceType;
        private readonly string _stage;
        private readonly Activity? _activity;
        private readonly long _startedTimestamp;
        private string _outcome;
        private bool _completed;

        internal StageScope(PropagationMetrics owner, string resourceType, string stage)
        {
            _owner = owner;
            _resourceType = resourceType;
            _stage = stage;
            _startedTimestamp = Stopwatch.GetTimestamp();

            // T1. Gate checked BEFORE the span and its attributes are built, so a disabled category
            // costs one hash lookup. Metrics above are unaffected — they are always on.
            _activity = TraceGate.Current.ShouldTrace(TraceCategories.FlagChange)
                ? StartActivity(resourceType, stage)
                : null;

            // Fail closed: a scope disposed without an explicit outcome is a failure, so forgetting
            // to call Succeeded() cannot quietly inflate the success rate.
            _outcome = Outcomes.Failure;
            _completed = false;
        }

        private static Activity? StartActivity(string resourceType, string stage)
        {
            var activity = FeatBitActivitySources.Service.StartActivity(
                $"{resourceType}.{stage}", ActivityKind.Internal);

            if (activity is null)
            {
                return null;
            }

            activity.SetTag(ObservabilityTags.ResourceType, resourceType);
            activity.SetTag(ObservabilityTags.Stage, stage);

            // The change id rides on baggage, which children inherit, but baggage is not a tag —
            // so it is copied onto the span explicitly to make the span searchable by change.
            var changeId = ActivityCorrelation.CurrentChangeId;
            if (!string.IsNullOrEmpty(changeId))
            {
                activity.SetTag(CorrelationFields.ChangeId, changeId);
            }

            return activity;
        }

        /// <summary>Marks the stage as successful.</summary>
        public void Succeeded() => _outcome = Outcomes.Success;

        /// <summary>
        /// Marks the stage as partially successful — some, but not all, of its work completed. Used
        /// for a fan-out in which individual connections failed while the rest were delivered.
        /// </summary>
        public void Partial() => _outcome = PropagationStages.PartialOutcome;

        /// <summary>Marks the stage as failed.</summary>
        public void Failed() => _outcome = Outcomes.Failure;

        /// <summary>
        /// Records fan-out width on the span: how many connections were targeted and how many sends
        /// failed.
        /// </summary>
        /// <remarks>
        /// One aggregate span carries these counts rather than one span per connection. A change can
        /// fan out to thousands of connections, so per-connection spans would multiply trace volume
        /// by the connection count for no extra diagnostic value — the counts answer the same
        /// question. Per-connection outcomes remain available as
        /// <c>propagation.deliveries</c>, which is a metric and costs nothing per connection.
        /// </remarks>
        public void SetFanoutCounts(int targeted, int failed)
        {
            if (_activity is null)
            {
                return;
            }

            _activity.SetTag("fanout.targeted", targeted);
            _activity.SetTag("fanout.failed", failed);
        }

        /// <summary>Records the stage's outcome and duration.</summary>
        public void Dispose()
        {
            if (_owner is null || _completed)
            {
                return;
            }

            _completed = true;
            _owner.RecordStage(
                _resourceType, _stage, _outcome, Stopwatch.GetElapsedTime(_startedTimestamp));

            if (_activity is null)
            {
                return;
            }

            _activity.SetTag(ObservabilityTags.Outcome, _outcome);
            _activity.SetStatus(
                _outcome == Outcomes.Success ? ActivityStatusCode.Ok : ActivityStatusCode.Error);
            _activity.Dispose();
        }
    }
}

/// <summary>
/// The fixed stage vocabulary for <see cref="PropagationMetrics"/>.
/// </summary>
/// <remarks>
/// These are constants rather than derived from type or method names on purpose: a rename would
/// otherwise silently rename the metric series with no compile error and no test failure.
/// </remarks>
public static class PropagationStages
{
    /// <summary>The API writing the change to the cache and revision store.</summary>
    public const string Persist = "persist";

    /// <summary>Handing the change to the message queue.</summary>
    public const string Publish = "publish";

    /// <summary>Receiving and decoding the change from the message queue.</summary>
    public const string Consume = "consume";

    /// <summary>The control plane replicating the change to peer datacenters and republishing it.</summary>
    public const string Relay = "relay";

    /// <summary>The evaluation server pushing the change to every subscribed connection.</summary>
    public const string Fanout = "fanout";

    /// <summary>
    /// Outcome for a stage that partly succeeded — recorded separately because a fan-out that
    /// reached most connections is neither a success nor an outage, and collapsing it into either
    /// hides the only interesting case.
    /// </summary>
    public const string PartialOutcome = "partial";
}

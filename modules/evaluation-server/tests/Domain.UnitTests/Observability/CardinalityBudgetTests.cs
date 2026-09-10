using System.Diagnostics.Metrics;
using Domain.Observability;

namespace Domain.UnitTests.Observability;

/// <summary>
/// The cardinality budget, enforced mechanically rather than by review.
/// </summary>
/// <remarks>
/// <para>
/// A high-cardinality attribute does not fail anything at the point it is added. It fails weeks
/// later, in production, as an unbounded time-series explosion in whichever backend is scraping the
/// process — by which time the offending line is long merged. This suite exercises every recording
/// API in the module and asserts that no measurement anywhere carries a banned attribute name, so
/// the failure lands on the pull request that introduces it.
/// </para>
/// <para>
/// It is deliberately written as a sweep over real call sites rather than reflection over
/// instrument definitions: attributes are supplied at RECORD time, not at creation time, so
/// inspecting the instruments alone would prove nothing.
/// </para>
/// </remarks>
[Collection(ObservabilityCollection.Name)]
public sealed class CardinalityBudgetTests
{
    /// <summary>
    /// Exercises every M2/M3/M5 recording path in this module and asserts the banned-attribute list
    /// holds across all of them.
    /// </summary>
    [Fact]
    public void Instruments_AcrossTheWholeModule_RecordNoBannedAttribute()
    {
        using var meter = new Meter("FeatBit.Test.Cardinality." + Guid.NewGuid());

        using var moduleCollector = new MetricCollector(meter);
        using var messagingCollector = new MetricCollector(MessagingMetrics.Current.Meter);
        using var propagationCollector = new MetricCollector(PropagationMetrics.Current.Meter);
        using var streamingCollector = new MetricCollector(StreamingMetrics.Current.Meter);
        using var storeCollector = new MetricCollector(StoreMetrics.Current.Meter);
        using var rateLimitCollector = new MetricCollector(RateLimitMetrics.Current.Meter);
        using var evaluationCollector = new MetricCollector(EvaluationMetrics.Current.Meter);
        using var syncCollector = new MetricCollector(SyncMetrics.Current.Meter);
        using var insightsCollector = new MetricCollector(InsightsMetrics.Current.Meter);
        using var agentCollector = new MetricCollector(AgentMetrics.Current.Meter);

        ExerciseWorkerAndBuffer(meter);
        ExerciseMessaging();
        ExercisePropagation();
        ExerciseEvaluationServerMetrics();
        ExerciseP14Metrics();

        moduleCollector.CollectObservableInstruments();
        streamingCollector.CollectObservableInstruments();
        storeCollector.CollectObservableInstruments();

        var all = moduleCollector.Measurements
            .Concat(messagingCollector.Measurements)
            .Concat(propagationCollector.Measurements)
            .Concat(streamingCollector.Measurements)
            .Concat(storeCollector.Measurements)
            .Concat(rateLimitCollector.Measurements)
            .Concat(evaluationCollector.Measurements)
            .Concat(syncCollector.Measurements)
            .Concat(insightsCollector.Measurements)
            .Concat(agentCollector.Measurements)
            .ToArray();

        Assert.NotEmpty(all);

        var violations = all
            .SelectMany(m => m.Tags.Keys.Select(key => (m.InstrumentName, Key: key)))
            .Where(pair => ObservabilityTags.Banned.Contains(pair.Key, StringComparer.OrdinalIgnoreCase))
            .Distinct()
            .ToArray();

        Assert.Empty(violations);
    }

    /// <summary>
    /// Every attribute recorded anywhere in the module must come from the documented allowlist. The
    /// banned list catches the mistakes we have already thought of; this catches the ones we have
    /// not, by requiring a new attribute name to be added to the standard deliberately.
    /// </summary>
    [Fact]
    public void Instruments_AcrossTheWholeModule_RecordOnlyAllowlistedAttributes()
    {
        using var meter = new Meter("FeatBit.Test.Allowlist." + Guid.NewGuid());

        using var moduleCollector = new MetricCollector(meter);
        using var messagingCollector = new MetricCollector(MessagingMetrics.Current.Meter);
        using var propagationCollector = new MetricCollector(PropagationMetrics.Current.Meter);
        using var streamingCollector = new MetricCollector(StreamingMetrics.Current.Meter);
        using var storeCollector = new MetricCollector(StoreMetrics.Current.Meter);
        using var rateLimitCollector = new MetricCollector(RateLimitMetrics.Current.Meter);
        using var evaluationCollector = new MetricCollector(EvaluationMetrics.Current.Meter);
        using var syncCollector = new MetricCollector(SyncMetrics.Current.Meter);
        using var insightsCollector = new MetricCollector(InsightsMetrics.Current.Meter);
        using var agentCollector = new MetricCollector(AgentMetrics.Current.Meter);

        ExerciseWorkerAndBuffer(meter);
        ExerciseMessaging();
        ExercisePropagation();
        ExerciseEvaluationServerMetrics();
        ExerciseP14Metrics();

        moduleCollector.CollectObservableInstruments();
        streamingCollector.CollectObservableInstruments();
        storeCollector.CollectObservableInstruments();

        var allowed = new HashSet<string>(StringComparer.Ordinal)
        {
            ObservabilityTags.Outcome,
            ObservabilityTags.Operation,
            ObservabilityTags.Provider,
            ObservabilityTags.Destination,
            ObservabilityTags.ResourceType,
            ObservabilityTags.DcId,
            ObservabilityTags.ConnectionType,
            ObservabilityTags.Reason,
            ObservabilityTags.ErrorType,
            ObservabilityTags.Worker,
            ObservabilityTags.Buffer,
            ObservabilityTags.Stage
        };

        var unexpected = moduleCollector.Measurements
            .Concat(messagingCollector.Measurements)
            .Concat(propagationCollector.Measurements)
            .Concat(streamingCollector.Measurements)
            .Concat(storeCollector.Measurements)
            .Concat(rateLimitCollector.Measurements)
            .Concat(evaluationCollector.Measurements)
            .Concat(syncCollector.Measurements)
            .Concat(insightsCollector.Measurements)
            .Concat(agentCollector.Measurements)
            .SelectMany(m => m.Tags.Keys)
            .Where(key => !allowed.Contains(key))
            .Distinct()
            .ToArray();

        Assert.Empty(unexpected);
    }

    /// <summary>
    /// The banned list must actually be capable of failing. A test that only ever asserts "no
    /// violations" passes just as happily against an empty rule set, so the rule itself is pinned.
    /// </summary>
    [Fact]
    public void Banned_AsDeclared_CoversTheIdentifiersTheStandardForbids()
    {
        Assert.Contains("env_id", ObservabilityTags.Banned);
        Assert.Contains("instance_id", ObservabilityTags.Banned);
        Assert.Contains("flag_key", ObservabilityTags.Banned);
        Assert.Contains("user_id", ObservabilityTags.Banned);
        Assert.Contains("token", ObservabilityTags.Banned);
        Assert.Contains("client.ip", ObservabilityTags.Banned);
    }

    /// <summary>
    /// <c>dc_id</c> is the one identifier-shaped attribute the standard permits, because it is
    /// bounded by deployment topology and is the only way to see a single-datacenter outage. If it
    /// ever lands on the banned list, that is a decision, not an accident.
    /// </summary>
    [Fact]
    public void Banned_ForDcId_PermitsItBecauseDeploymentTopologyBoundsIt()
        => Assert.DoesNotContain(ObservabilityTags.DcId, ObservabilityTags.Banned);

    private static void ExerciseWorkerAndBuffer(Meter meter)
    {
        var worker = new WorkerObservability(meter, FeatBitInstruments.EvaluationServerPrefix, WorkerNames.StoreSentinel);
        worker.Started();
        worker.Heartbeat();
        worker.Success();
        worker.LoopFailed(new InvalidOperationException());
        worker.Stopped();

        var buffer = new BufferObservability(
            meter, FeatBitInstruments.EvaluationServerPrefix, BufferNames.PostgresNotifications, capacity: 10, () => 1);
        buffer.RecordDropped(2);
        using (buffer.TrackBlockedWriter())
        {
        }

        var sizedBuffer = new BufferObservability(
            meter,
            FeatBitInstruments.EvaluationServerPrefix,
            BufferNames.Insights,
            capacity: 10,
            () => 1,
            trackBytes: true);
        sizedBuffer.AddBytes(512);
        sizedBuffer.RemoveBytes(128);
    }

    private static void ExerciseMessaging()
    {
        var metrics = MessagingMetrics.Current;

        using (var publish = metrics.BeginPublish("kafka", "featbit-cardinality-probe"))
        {
            publish.Enqueued();
        }

        using (var failed = metrics.BeginPublish("redis", "featbit-cardinality-probe"))
        {
            failed.Failed(new TimeoutException());
        }

        using (var consume = metrics.BeginConsume("postgres", "featbit-cardinality-probe"))
        {
            consume.Succeeded();
        }

        metrics.RecordUnroutable("kafka", "featbit-cardinality-probe");
        metrics.RecordRedelivered("postgres", "featbit-cardinality-probe", 2);
        metrics.RecordDeliveryFailure("kafka", "featbit-cardinality-probe");
    }

    private static void ExercisePropagation()
    {
        var metrics = PropagationMetrics.Current;

        using (var stage = metrics.BeginStage(ChangeId.FlagResource, PropagationStages.Persist))
        {
            stage.Succeeded();
        }

        using (var fanout = metrics.RecordFanout(ChangeId.SegmentResource))
        {
            fanout.Partial();
        }

        metrics.RecordDelivery(ChangeId.FlagResource, Outcomes.Success);
    }

    /// <summary>
    /// The evaluation-server-only instruments. <c>connection_type</c> and <c>reason</c> are the two
    /// attributes here that originate outside the process, so they are the ones most likely to
    /// smuggle in unbounded values.
    /// </summary>
    private static void ExerciseEvaluationServerMetrics()
    {
        var streaming = StreamingMetrics.Current;
        streaming.RecordUpgrade("client", Outcomes.Success, StreamingReasons.Accepted);
        streaming.RecordUpgrade("../../etc/passwd", Outcomes.Rejected, StreamingReasons.InvalidRequest);
        streaming.SocketOpened();
        streaming.SocketClosed("server", StreamingReasons.ClientClosed, TimeSpan.FromSeconds(3));

        var store = StoreMetrics.Current;
        store.RecordAvailabilityCheck("redis", Outcomes.Success, TimeSpan.FromMilliseconds(4));
        store.RecordAvailabilityCheck("mongodb", Outcomes.Timeout, TimeSpan.FromMilliseconds(2000));
        store.RecordFailover("mongodb");
        store.RecordNoStoreAvailable();

        var rateLimit = RateLimitMetrics.Current;
        rateLimit.RecordDecision("streaming", Outcomes.Rejected, TimeSpan.FromMilliseconds(1));
        rateLimit.RecordDecision("streaming", Outcomes.FailOpen, TimeSpan.FromMilliseconds(1));
    }

    /// <summary>
    /// The M7/M8/M9 instruments added in P14. Three of these take values that originate outside the
    /// process — a rule name, a wire message type, and an SDK-supplied connection type — so they are
    /// exercised here with hostile values to prove the normalization actually bounds them.
    /// </summary>
    private static void ExerciseP14Metrics()
    {
        var evaluation = EvaluationMetrics.Current;
        evaluation.RecordEvaluation(
            Outcomes.Success, EvaluationReasons.RuleMatch, TimeSpan.FromMilliseconds(1));
        evaluation.RecordEvaluation(
            Outcomes.Failure, EvaluationReasons.Error, TimeSpan.FromMilliseconds(1));
        evaluation.RecordMalformedEntity(ChangeId.FlagResource);

        var sync = SyncMetrics.Current;
        sync.RecordPayload(
            "full", "client", Outcomes.Success, TimeSpan.FromMilliseconds(5), 12);
        sync.RecordPayload(
            "patch", "../../etc/passwd", Outcomes.Failure,
            TimeSpan.FromMilliseconds(5), itemCount: null);

        var streaming = StreamingMetrics.Current;
        streaming.RecordMessage(
            "data-sync", Outcomes.Success, StreamingReasons.Accepted, TimeSpan.FromMilliseconds(2),
            sizeBytes: 512);
        streaming.RecordMessage(
            StreamingReasons.Unknown, Outcomes.Rejected, StreamingReasons.UnknownType,
            TimeSpan.FromMilliseconds(1), sizeBytes: 64);
        streaming.RecordSentMessage("data-sync", 4096);

        var insights = InsightsMetrics.Current;
        insights.RecordReceived(Outcomes.Success, 3);
        insights.RecordReceived(Outcomes.Rejected, 1);
        insights.RecordFlush(Outcomes.Success, 3, TimeSpan.FromMilliseconds(7));
        insights.RecordRequestSize(2048);

        var agent = AgentMetrics.Current;
        agent.RecordRegistration(Outcomes.Success, AgentReasons.Registered);
        agent.RecordRegistration(Outcomes.Rejected, AgentReasons.QuotaExceeded);
    }
}

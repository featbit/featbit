using System.Diagnostics;
using System.Diagnostics.Metrics;
using Domain.Observability;

namespace Api.Application.ControlPlane;

/// <summary>
/// Control-plane–specific instrumentation: per-DC cache fan-out, and failures that the messaging
/// instrumentation cannot see.
/// </summary>
/// <remarks>
/// <para>
/// <b>Why suppressed failures need their own counter.</b> The MQ consumers already record
/// <c>messaging.consumed{outcome}</c> for every message, and each control-plane handler owns exactly
/// one topic — so a handler that <i>throws</i> is already visible as a consume failure, and adding a
/// second per-handler outcome counter would only double-count it. What is <em>not</em> visible is a
/// handler that catches the problem and returns normally: a malformed payload, a null after
/// deserialization, a missing pod id. The consumer sees a clean return and records success, so those
/// failures are invisible today at every layer. This counter closes exactly that gap and nothing
/// else. The swallow behavior itself is unchanged (follow-up F7).
/// </para>
/// <para>
/// <b>Fan-out is measured per DC, because that is the failure mode.</b>
/// <c>CompositeRedisCacheService</c> deliberately continues when one DC's Redis fails, so a single
/// unreachable DC produces no error anywhere in the aggregate — flag changes simply stop arriving
/// there. Tagging by <c>dc_id</c> (bounded by deployment topology, so it stays inside the
/// cardinality budget) makes a one-DC outage visible as a per-DC failure rate rather than as silence.
/// </para>
/// </remarks>
public sealed class ControlPlaneMetrics
{
    private ControlPlaneMetrics(Meter meter, string instrumentPrefix)
    {
        Meter = meter;

        SuppressedFailures = meter.CreateCounter<long>(
            $"{instrumentPrefix}handler.suppressed_failures",
            unit: "{failure}",
            description:
            "Handler failures that were caught and not rethrown, so the message was acknowledged " +
            "as successfully consumed. Invisible in messaging.consumed by construction.");

        BroadcastOperations = meter.CreateCounter<long>(
            $"{instrumentPrefix}cache.broadcast_operations",
            unit: "{operation}",
            description:
            "Per-DC cache fan-out operations by dc_id, operation, and outcome. A failure here is " +
            "swallowed so other DCs still receive the write, which is why it needs a counter.");

        BroadcastDuration = meter.CreateHistogram<double>(
            $"{instrumentPrefix}cache.broadcast_duration",
            unit: "ms",
            description:
            "Duration of one per-DC cache fan-out operation. The slowest DC bounds the whole " +
            "broadcast, so a per-DC distribution is what localizes a stall.");

        LeaderTransitions = meter.CreateCounter<long>(
            $"{instrumentPrefix}leader.transitions",
            unit: "{transition}",
            description:
            "Leadership changes by transition. Steady state is zero; a nonzero rate means the " +
            "lease is flapping, which stalls every leader-gated worker.");

        PodEvictions = meter.CreateCounter<long>(
            $"{instrumentPrefix}pod_health.evictions",
            unit: "{pod}",
            description:
            "Evaluation-server pods evicted for a stale heartbeat, and pods skipped because their " +
            "id was unparseable — the latter are never evicted and would otherwise accumulate " +
            "unnoticed.");

        DcBackfills = meter.CreateCounter<long>(
            $"{instrumentPrefix}recovery.dc_backfills",
            unit: "{backfill}",
            description:
            "Per-DC backfill attempts for a returning DC, by outcome. 'skipped' means the work " +
            "coalesced with a concurrent backfill, not that it failed.");
    }

    /// <summary>The instrumentation in use for the running service.</summary>
    public static ControlPlaneMetrics Current { get; } =
        new(new Meter(FeatBitMeters.ControlPlane), FeatBitInstruments.ControlPlanePrefix);

    /// <summary>The owning meter. Exposed so tests can listen to this instance specifically.</summary>
    public Meter Meter { get; }

    /// <summary>Counter of caught-and-not-rethrown handler failures.</summary>
    public Counter<long> SuppressedFailures { get; }

    /// <summary>Counter of per-DC cache fan-out operations.</summary>
    public Counter<long> BroadcastOperations { get; }

    /// <summary>Distribution of per-DC cache fan-out durations.</summary>
    public Histogram<double> BroadcastDuration { get; }

    /// <summary>Counter of leadership transitions.</summary>
    public Counter<long> LeaderTransitions { get; }

    /// <summary>Counter of pod-health evictions and skips.</summary>
    public Counter<long> PodEvictions { get; }

    /// <summary>Counter of per-DC recovery backfills.</summary>
    public Counter<long> DcBackfills { get; }

    /// <summary>Records a leadership transition.</summary>
    /// <param name="transition">A value from <see cref="LeaderTransitionKinds"/>.</param>
    public void RecordLeaderTransition(string transition)
        => LeaderTransitions.Add(
            1, new KeyValuePair<string, object?>(ObservabilityTags.Reason, transition));

    /// <summary>Records a pod-health eviction or skip.</summary>
    /// <param name="reason">A value from <see cref="PodEvictionReasons"/>.</param>
    /// <param name="outcome">A value from <c>Outcomes</c>.</param>
    public void RecordPodEviction(string reason, string outcome)
        => PodEvictions.Add(
            1,
            new KeyValuePair<string, object?>(ObservabilityTags.Reason, reason),
            new KeyValuePair<string, object?>(ObservabilityTags.Outcome, outcome));

    /// <summary>Records a per-DC backfill attempt for a returning DC.</summary>
    /// <param name="dcId">The target DC.</param>
    /// <param name="outcome">A value from <see cref="BackfillOutcomes"/>.</param>
    public void RecordDcBackfill(string dcId, string outcome)
        => DcBackfills.Add(
            1,
            new KeyValuePair<string, object?>(ObservabilityTags.DcId, dcId),
            new KeyValuePair<string, object?>(ObservabilityTags.Outcome, outcome));

    /// <summary>
    /// Records a failure a handler caught and did not rethrow.
    /// </summary>
    /// <param name="handler">The handler name, from <see cref="HandlerNames"/>.</param>
    /// <param name="reason">
    /// A value from <see cref="SuppressedFailureReasons"/>. Free text is never accepted here: the
    /// obvious thing to pass would be the exception message or the offending field, both of which
    /// are unbounded and can carry payload data.
    /// </param>
    public void RecordSuppressedFailure(string handler, string reason)
        => SuppressedFailures.Add(
            1,
            new KeyValuePair<string, object?>(ObservabilityTags.Operation, handler),
            new KeyValuePair<string, object?>(ObservabilityTags.Reason, reason));

    /// <summary>Records one per-DC cache fan-out operation.</summary>
    public void RecordBroadcast(string dcId, string operation, string outcome, TimeSpan duration)
    {
        var tags = new[]
        {
            new KeyValuePair<string, object?>(ObservabilityTags.DcId, dcId),
            new KeyValuePair<string, object?>(ObservabilityTags.Operation, operation),
            new KeyValuePair<string, object?>(ObservabilityTags.Outcome, outcome)
        };

        BroadcastOperations.Add(1, tags);
        BroadcastDuration.Record(duration.TotalMilliseconds, tags);
    }

    /// <summary>Times one per-DC fan-out operation.</summary>
    public BroadcastScope BeginBroadcast(string dcId, string operation) => new(this, dcId, operation);

    /// <summary>Times one per-DC cache fan-out operation. Created by <see cref="BeginBroadcast"/>.</summary>
    public struct BroadcastScope : IDisposable
    {
        private readonly ControlPlaneMetrics _owner;
        private readonly string _dcId;
        private readonly string _operation;
        private readonly long _startedTimestamp;
        private string _outcome;
        private bool _completed;

        internal BroadcastScope(ControlPlaneMetrics owner, string dcId, string operation)
        {
            _owner = owner;
            _dcId = dcId;
            _operation = operation;
            _startedTimestamp = Stopwatch.GetTimestamp();

            // Fail closed: a scope disposed without an explicit outcome is a failure, so a missed
            // call cannot quietly inflate the success rate.
            _outcome = Outcomes.Failure;
            _completed = false;
        }

        /// <summary>Marks the operation as successful.</summary>
        public void Succeeded() => _outcome = Outcomes.Success;

        /// <summary>Marks the operation as failed.</summary>
        public void Failed() => _outcome = Outcomes.Failure;

        /// <summary>Records the outcome and duration.</summary>
        public void Dispose()
        {
            if (_owner is null || _completed)
            {
                return;
            }

            _completed = true;
            _owner.RecordBroadcast(_dcId, _operation, _outcome, Stopwatch.GetElapsedTime(_startedTimestamp));
        }
    }
}

/// <summary>Stable handler names for the <see cref="ObservabilityTags.Operation"/> attribute.</summary>
public static class HandlerNames
{
    /// <summary>Handles a client WebSocket connection being established.</summary>
    public const string ClientConnectionMade = "client_connection_made";

    /// <summary>Handles a client WebSocket connection being closed.</summary>
    public const string ClientConnectionClosed = "client_connection_closed";

    /// <summary>Handles an evaluation-server pod heartbeat.</summary>
    public const string Heartbeat = "heartbeat";
}

/// <summary>
/// The fixed reason vocabulary for <see cref="ControlPlaneMetrics.RecordSuppressedFailure"/>.
/// </summary>
public static class SuppressedFailureReasons
{
    /// <summary>The message could not be parsed as JSON.</summary>
    public const string DeserializationFailed = "deserialization_failed";

    /// <summary>The message parsed but a required field was missing or empty.</summary>
    public const string ValidationFailed = "validation_failed";

    /// <summary>An exception was caught and not rethrown, so the message was acknowledged.</summary>
    public const string Unhandled = "unhandled";
}

/// <summary>The fixed vocabulary for <see cref="ControlPlaneMetrics.RecordLeaderTransition"/>.</summary>
public static class LeaderTransitionKinds
{
    /// <summary>This instance took the lease and became leader.</summary>
    public const string Acquired = "acquired";

    /// <summary>This instance held the lease and failed to extend it.</summary>
    public const string Lost = "lost";

    /// <summary>This instance released the lease during graceful shutdown.</summary>
    public const string Released = "released";

    /// <summary>
    /// A Redis error forced this instance to assume not-leader. Distinct from
    /// <see cref="Lost"/>: leadership may in fact still be held, so the cluster can transiently
    /// have no acting leader at all — a different incident with a different cause.
    /// </summary>
    public const string ErrorDemoted = "error_demoted";
}

/// <summary>The fixed vocabulary for <see cref="ControlPlaneMetrics.RecordPodEviction"/>.</summary>
public static class PodEvictionReasons
{
    /// <summary>The pod's last heartbeat is older than the configured timeout.</summary>
    public const string HeartbeatTimeout = "heartbeat_timeout";

    /// <summary>The pod id could not be parsed, so the entry can never be evicted.</summary>
    public const string InvalidPodId = "invalid_pod_id";
}

/// <summary>The fixed vocabulary for <see cref="ControlPlaneMetrics.RecordDcBackfill"/>.</summary>
public static class BackfillOutcomes
{
    /// <summary>The backfill ran and at least one write was accepted.</summary>
    public const string Repaired = "repaired";

    /// <summary>The backfill ran and accepted nothing — the DC already matched.</summary>
    public const string NoChange = "no_change";

    /// <summary>The backfill coalesced with one already in flight for that DC.</summary>
    public const string Coalesced = "coalesced";
}

/// <summary>
/// Stable names for the control-plane's background workers.
/// </summary>
/// <remarks>
/// These live here rather than in the back-end's <c>WorkerNames</c> because that file is duplicated
/// verbatim into the evaluation server, and adding control-plane-only names to it would put
/// unreachable constants in a service that has none of these workers.
/// </remarks>
public static class ControlPlaneWorkerNames
{
    /// <summary>Detects newly-reachable DCs and backfills them.</summary>
    public const string CacheReconciler = "cache_reconciler";

    /// <summary>Commits pending flag/segment changes once every live DC has them staged.</summary>
    public const string CommitCoordinator = "commit_coordinator";

    /// <summary>Compares configured DcIds against reporting lease DcIds.</summary>
    public const string DcIdConsistencyChecker = "dcid_consistency_checker";

    /// <summary>Evicts evaluation-server pods whose heartbeat has gone stale.</summary>
    public const string PodHealthChecker = "pod_health_checker";

    /// <summary>Backfills a DC that has returned to the live set.</summary>
    public const string RecoveryWorker = "recovery_worker";

    /// <summary>Maintains the Redis leadership lease.</summary>
    public const string LeaderElector = "leader_elector";
}

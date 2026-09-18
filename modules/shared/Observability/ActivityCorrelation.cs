#nullable enable

using System.Diagnostics;

namespace Domain.Observability;

/// <summary>
/// Canonical correlation field names. Fixed here so every log, span, and metric in the estate spells
/// them identically; see <c>docs/observability/index.md</c> §7.
/// </summary>
public static class CorrelationFields
{
    /// <summary>W3C trace identifier of the ambient <see cref="Activity"/>.</summary>
    public const string TraceId = "trace_id";

    /// <summary>W3C span identifier of the ambient <see cref="Activity"/>.</summary>
    public const string SpanId = "span_id";

    /// <summary>Identifier of one logical flag/segment change; see <see cref="ChangeId"/>.</summary>
    public const string ChangeId = "change_id";

    /// <summary>Streaming connection identifier.</summary>
    public const string ConnectionId = "connection.id";

    /// <summary>Data-center identifier.</summary>
    public const string DcId = "dc_id";

    /// <summary>Environment identifier. Permitted on logs and spans, never on metrics.</summary>
    public const string EnvId = "env_id";
}

/// <summary>
/// In-process correlation: guarantees that a trace and span identifier exist for every unit of work,
/// so log records can be stitched together even when no telemetry exporter is configured.
/// </summary>
/// <remarks>
/// <para>
/// <b>Why this type exists.</b> <see cref="Activity"/> objects are only created when something is
/// listening. With no OpenTelemetry SDK in the process, <see cref="Activity.Current"/> is always
/// <c>null</c>, every trace identifier is empty, and logs cannot be correlated at all.
/// <see cref="EnsureListener"/> registers a listener that samples at
/// <see cref="ActivitySamplingResult.PropagationData"/>: activities are created and carry valid
/// W3C identifiers, but are not recorded and collect no data. That is the cheapest sampling level
/// which still yields usable identifiers.
/// </para>
/// <para>
/// <b>It cannot suppress real tracing.</b> When several listeners observe the same source, the
/// highest sampling result wins, so an exporter that asks for
/// <see cref="ActivitySamplingResult.AllDataAndRecorded"/> still gets it. Registering this listener
/// is therefore always safe, whether or not export is configured.
/// </para>
/// <para>
/// <b>Scope.</b> Only FeatBit's own sources and ASP.NET Core's request source are observed. Listening
/// to every source in the process would switch on activity creation inside HTTP, SQL, and Redis
/// client libraries, which sit on hot paths and would add cost for no correlation benefit that the
/// request-level activity does not already provide.
/// </para>
/// </remarks>
public static class ActivityCorrelation
{
    /// <summary>
    /// Prefix identifying FeatBit's own activity sources; see <see cref="FeatBitActivitySources"/>.
    /// </summary>
    public const string FeatBitSourcePrefix = "FeatBit";

    /// <summary>
    /// ASP.NET Core's activity source, which emits the per-request activity. Observing it is what
    /// gives every request-scoped log record a trace identifier.
    /// </summary>
    public const string AspNetCoreSourcePrefix = "Microsoft.AspNetCore";

    private static readonly object SyncRoot = new();
    private static ActivityListener? _listener;

    /// <summary>Whether <see cref="EnsureListener"/> has registered the listener.</summary>
    public static bool IsListenerRegistered
    {
        get
        {
            lock (SyncRoot)
            {
                return _listener is not null;
            }
        }
    }

    /// <summary>
    /// Registers the propagation-only listener. Idempotent: calling it repeatedly, from tests or
    /// from several hosts in one process, registers exactly one listener.
    /// </summary>
    public static void EnsureListener()
    {
        lock (SyncRoot)
        {
            if (_listener is not null)
            {
                return;
            }

            var listener = new ActivityListener
            {
                ShouldListenTo = static source => ShouldListenTo(source.Name),
                Sample = static (ref ActivityCreationOptions<ActivityContext> _)
                    => ActivitySamplingResult.PropagationData,
                SampleUsingParentId = static (ref ActivityCreationOptions<string> _)
                    => ActivitySamplingResult.PropagationData
            };

            ActivitySource.AddActivityListener(listener);
            _listener = listener;
        }
    }

    /// <summary>
    /// Removes the listener. Intended for tests that need to assert behavior with correlation off;
    /// production code registers once at startup and never unregisters.
    /// </summary>
    public static void RemoveListener()
    {
        lock (SyncRoot)
        {
            _listener?.Dispose();
            _listener = null;
        }
    }

    /// <summary>Whether <paramref name="sourceName"/> is in scope for the listener.</summary>
    public static bool ShouldListenTo(string? sourceName)
    {
        if (string.IsNullOrEmpty(sourceName))
        {
            return false;
        }

        return sourceName.StartsWith(FeatBitSourcePrefix, StringComparison.Ordinal)
               || sourceName.StartsWith(AspNetCoreSourcePrefix, StringComparison.Ordinal);
    }

    /// <summary>
    /// Trace identifier of the ambient activity, or <c>null</c> when there is none. Never returns
    /// the all-zero identifier, which reads as a real value in a log field but means "unset".
    /// </summary>
    public static string? TraceId => TraceIdOf(Activity.Current);

    /// <summary>Span identifier of the ambient activity, or <c>null</c> when there is none.</summary>
    public static string? SpanId => SpanIdOf(Activity.Current);

    /// <summary>Trace identifier of <paramref name="activity"/>, or <c>null</c> when unavailable.</summary>
    public static string? TraceIdOf(Activity? activity)
    {
        if (activity is null || activity.IdFormat != ActivityIdFormat.W3C)
        {
            return null;
        }

        var traceId = activity.TraceId;
        return traceId == default ? null : traceId.ToHexString();
    }

    /// <summary>Span identifier of <paramref name="activity"/>, or <c>null</c> when unavailable.</summary>
    public static string? SpanIdOf(Activity? activity)
    {
        if (activity is null || activity.IdFormat != ActivityIdFormat.W3C)
        {
            return null;
        }

        var spanId = activity.SpanId;
        return spanId == default ? null : spanId.ToHexString();
    }

    /// <summary>
    /// The change identifier attached to the ambient activity, or <c>null</c> when none is in scope.
    /// </summary>
    public static string? CurrentChangeId => Activity.Current?.GetBaggageItem(CorrelationFields.ChangeId);

    /// <summary>
    /// Attaches <paramref name="changeId"/> to the ambient activity so that every later stage in the
    /// same service can read it back through <see cref="CurrentChangeId"/>.
    /// </summary>
    /// <remarks>
    /// The value is stored both as baggage — which child activities inherit, so nested stages see it
    /// without being passed it explicitly — and as a tag, so it is visible on the span itself once
    /// export is configured. Returns the activity to allow call-site chaining; <c>null</c> when no
    /// activity is in scope, in which case this is a no-op.
    /// </remarks>
    public static Activity? SetChangeId(string changeId)
    {
        var activity = Activity.Current;
        if (activity is null || string.IsNullOrEmpty(changeId))
        {
            return activity;
        }

        activity.SetBaggage(CorrelationFields.ChangeId, changeId);
        activity.SetTag(CorrelationFields.ChangeId, changeId);
        return activity;
    }
}

#nullable enable

using System.Diagnostics;

namespace Domain.Observability;

/// <summary>
/// Serializes and deserializes W3C trace context so a trace can span the message-queue hop.
/// </summary>
/// <remarks>
/// <para>
/// Until this existed, <see cref="IngressActivity.StartConsume(string, string)"/> deliberately
/// started every consumed message as its own root trace, because no trace context was carried on
/// the wire. That made per-service stages correlatable but left the producing and consuming halves
/// of a flag change in two unjoinable traces.
/// </para>
/// <para>
/// This type is transport-agnostic and deliberately BCL-only: it deals in strings, never in a
/// broker's header type. <c>shared/Observability</c> is referenced by every module's
/// <c>Domain</c> project, so taking a dependency on Confluent.Kafka here would push a broker client
/// into projects that must not have one. Each transport owns the few lines that convert between its
/// own representation and these strings — Kafka message headers, two <c>queue_messages</c> columns
/// under Postgres, and for Redis a pair of payload properties written by
/// <see cref="JsonTraceContext"/>.
/// </para>
/// <para>
/// <b>Compatible in both directions, which is what makes this safe to roll out.</b> A new producer
/// against an old consumer is fine — an unread Kafka header, an unselected column, and an unknown
/// JSON property are all simply ignored. An old producer against a new consumer is fine too —
/// <see cref="Extract"/> returns <see langword="default"/> when the value is absent, and a default
/// <see cref="ActivityContext"/> parent means "start a new trace", which is exactly the previous
/// behavior. There is therefore no ordering requirement on a rolling upgrade. The one genuine
/// ordering requirement is not in this code: the Postgres columns must exist before a producer that
/// names them starts writing.
/// </para>
/// </remarks>
public static class TraceContextPropagation
{
    /// <summary>The W3C <c>traceparent</c> header name, carrying trace id, span id, and flags.</summary>
    public const string TraceParentHeader = "traceparent";

    /// <summary>The W3C <c>tracestate</c> header name, carrying vendor-specific state.</summary>
    public const string TraceStateHeader = "tracestate";

    /// <summary>
    /// The largest header value that will be parsed. The W3C spec caps <c>tracestate</c> at 512
    /// bytes and a <c>traceparent</c> is a fixed 55 characters, so anything beyond this is
    /// malformed or hostile. Bounding it means a remote producer cannot make this process allocate
    /// an arbitrarily large string during message handling.
    /// </summary>
    public const int MaxHeaderLength = 1024;

    /// <summary>
    /// Renders <paramref name="activity"/> as W3C trace context for placing on the wire.
    /// </summary>
    /// <param name="activity">
    /// Usually <see cref="Activity.Current"/>. A <see langword="null"/> activity is normal — it
    /// means nothing is listening — and yields <see langword="false"/> rather than an exception.
    /// </param>
    /// <param name="traceParent">The <c>traceparent</c> value, when this returns true.</param>
    /// <param name="traceState">The <c>tracestate</c> value, or <see langword="null"/> if empty.</param>
    /// <returns>
    /// <see langword="true"/> when there is context worth propagating. <see langword="false"/> when
    /// there is not, in which case the caller should send no headers at all — an absent header and
    /// an empty one are both handled by <see cref="Extract"/>, but sending nothing keeps the
    /// message identical to what an older producer would have written.
    /// </returns>
    public static bool TryInject(Activity? activity, out string traceParent, out string? traceState)
    {
        traceParent = string.Empty;
        traceState = null;

        // A hierarchical-format activity has no W3C identifiers to render. Activity.Id would still
        // be non-null, so checking the format rather than the id is what stops a malformed
        // traceparent going on the wire.
        if (activity is null || activity.IdFormat != ActivityIdFormat.W3C)
        {
            return false;
        }

        var id = activity.Id;
        if (string.IsNullOrEmpty(id))
        {
            return false;
        }

        traceParent = id;
        traceState = string.IsNullOrEmpty(activity.TraceStateString) ? null : activity.TraceStateString;

        return true;
    }

    /// <summary>
    /// Parses W3C trace context received from the wire.
    /// </summary>
    /// <param name="traceParent">The received <c>traceparent</c>, or <see langword="null"/>.</param>
    /// <param name="traceState">The received <c>tracestate</c>, or <see langword="null"/>.</param>
    /// <returns>
    /// The remote context, or <see langword="default"/> when the header is absent, oversized, or
    /// unparseable. A default context is a valid "no parent" and starts a fresh trace, so a
    /// malformed header degrades to the old behavior instead of failing the consume.
    /// </returns>
    public static ActivityContext Extract(string? traceParent, string? traceState)
    {
        if (string.IsNullOrEmpty(traceParent) || traceParent.Length > MaxHeaderLength)
        {
            return default;
        }

        if (traceState is { Length: > MaxHeaderLength })
        {
            // Drop oversized vendor state but still honor the parent: losing tracestate costs
            // vendor-specific sampling hints, whereas losing the parent breaks the trace outright.
            traceState = null;
        }

        // isRemote: true records that this context came from another process, which is what lets a
        // backend render the consume span as a continuation rather than a local child.
        return ActivityContext.TryParse(traceParent, traceState, isRemote: true, out var context)
            ? context
            : default;
    }
}

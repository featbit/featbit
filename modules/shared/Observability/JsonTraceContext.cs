#nullable enable

using System.Diagnostics;
using System.Text;
using System.Text.Json;

namespace Domain.Observability;

/// <summary>
/// Carries W3C trace context inside a JSON message payload, for transports that have no header
/// concept of their own.
/// </summary>
/// <remarks>
/// <para>
/// Kafka puts <c>traceparent</c>/<c>tracestate</c> in message headers, which producers and
/// consumers can add and ignore independently. Redis carries a bare JSON string and has nowhere
/// else to put them, so they are added as two extra <b>sibling properties</b> of the payload
/// object.
/// </para>
/// <para>
/// <b>Sibling properties, not an envelope.</b> Wrapping the payload
/// (<c>{"traceContext":…,"payload":{…}}</c>) would be a breaking wire change: an old consumer
/// would hand the wrapper to a handler expecting the message itself, and flag propagation would
/// stop silently. Adding properties alongside the existing ones is invisible to a consumer that
/// does not look for them, because every handler in the estate reads the payload by property name
/// and <c>System.Text.Json</c> ignores unknown properties by default. So this is compatible in
/// both directions, exactly like the Kafka headers, and needs no rollout ordering.
/// </para>
/// <para>
/// <b>Why splicing rather than parse-and-reserialize.</b> <see cref="Inject"/> is on the publish
/// path, and some publishers — insights in particular — are high throughput. Re-parsing a payload
/// into a <c>JsonNode</c> and serializing it again purely to add two properties would roughly
/// double the cost of every publish. Prepending into the already-serialized string is one pass and
/// one allocation, and it cannot produce invalid JSON: it only ever runs when the payload is
/// already a serialized object.
/// </para>
/// <para>
/// <b>It never throws.</b> A payload that is not a JSON object, or that already carries a
/// <c>traceparent</c> of its own, is returned untouched rather than mutated — losing the trace join
/// for that message is acceptable, corrupting a caller's message is not. Instrumentation must not
/// be able to stop message delivery.
/// </para>
/// </remarks>
public static class JsonTraceContext
{
    /// <summary>Payload property carrying the W3C <c>traceparent</c>.</summary>
    public const string TraceParentProperty = TraceContextPropagation.TraceParentHeader;

    /// <summary>Payload property carrying the W3C <c>tracestate</c>.</summary>
    public const string TraceStateProperty = TraceContextPropagation.TraceStateHeader;

    private const string QuotedTraceParent = "\"" + TraceParentProperty + "\"";

    /// <summary>
    /// Returns <paramref name="json"/> with the trace context of <paramref name="activity"/> added
    /// as sibling properties, or unchanged when there is nothing to add or nowhere to add it.
    /// </summary>
    /// <param name="json">A payload already serialized by the caller.</param>
    /// <param name="activity">Usually <see cref="Activity.Current"/>; <c>null</c> is normal.</param>
    public static string Inject(string json, Activity? activity)
    {
        // Only a serialized object has somewhere to put sibling properties. An array or a bare
        // value is returned untouched, which costs the trace join for that message and nothing else.
        if (string.IsNullOrEmpty(json) || json[0] != '{')
        {
            return json;
        }

        if (!TraceContextPropagation.TryInject(activity, out var traceParent, out var traceState))
        {
            return json;
        }

        // A payload that already has a traceparent of its own is left alone. Writing a second one
        // would create a duplicate key, and which of the two a reader sees is not well defined.
        if (json.Contains(QuotedTraceParent, StringComparison.Ordinal))
        {
            return json;
        }

        // An empty object ("{}") must not get a trailing comma. Scanning for the first meaningful
        // character rather than comparing against "{}" keeps this correct if the payload was ever
        // serialized with indentation.
        var rest = json.AsSpan(1);
        var firstMeaningful = 0;
        while (firstMeaningful < rest.Length && char.IsWhiteSpace(rest[firstMeaningful]))
        {
            firstMeaningful++;
        }

        var hasExistingProperties = firstMeaningful < rest.Length && rest[firstMeaningful] != '}';

        var builder = new StringBuilder(json.Length + traceParent.Length + (traceState?.Length ?? 0) + 40);

        // JsonEncodedText.Encode rather than raw appends: a traceparent is hex and dashes, but
        // tracestate carries vendor content that originated upstream, so it is not ours to trust.
        builder.Append('{')
            .Append(QuotedTraceParent)
            .Append(":\"").Append(JsonEncodedText.Encode(traceParent).Value).Append('"');

        if (!string.IsNullOrEmpty(traceState))
        {
            builder.Append(",\"").Append(TraceStateProperty)
                .Append("\":\"").Append(JsonEncodedText.Encode(traceState).Value).Append('"');
        }

        if (hasExistingProperties)
        {
            builder.Append(',');
        }

        builder.Append(rest);

        return builder.ToString();
    }

    /// <summary>
    /// Reads trace context back out of a payload.
    /// </summary>
    /// <returns>
    /// The producer's context, or <see langword="default"/> when the payload carries none or cannot
    /// be parsed. A default context means "start a new trace", which is the behavior this transport
    /// had before trace context was carried at all.
    /// </returns>
    public static ActivityContext Extract(string? json)
    {
        if (string.IsNullOrEmpty(json))
        {
            return default;
        }

        // Avoids parsing the payload a second time for the common case: every message written by a
        // producer that predates this, and every message published without an ambient activity.
        if (!json.Contains(QuotedTraceParent, StringComparison.Ordinal))
        {
            return default;
        }

        try
        {
            using var document = JsonDocument.Parse(json);

            var root = document.RootElement;
            if (root.ValueKind != JsonValueKind.Object)
            {
                return default;
            }

            return TraceContextPropagation.Extract(
                ReadString(root, TraceParentProperty),
                ReadString(root, TraceStateProperty));
        }
        catch (JsonException)
        {
            // A payload this cannot parse is still handled normally by its handler; it just starts
            // its own trace.
            return default;
        }

        static string? ReadString(JsonElement root, string property)
            => root.TryGetProperty(property, out var element) && element.ValueKind == JsonValueKind.String
                ? element.GetString()
                : null;
    }
}

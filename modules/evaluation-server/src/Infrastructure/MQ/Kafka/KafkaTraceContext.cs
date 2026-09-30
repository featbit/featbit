using System.Diagnostics;
using System.Text;
using Confluent.Kafka;
using Domain.Observability;

namespace Infrastructure.MQ.Kafka;

/// <summary>
/// Converts between Kafka message headers and W3C trace context, so a flag change produced here
/// and consumed in another service lands in one trace instead of two.
/// </summary>
/// <remarks>
/// <para>
/// The parsing and rendering rules live in <see cref="TraceContextPropagation"/>, which is
/// transport-agnostic and BCL-only. This type exists purely to bridge that to
/// <see cref="Headers"/>, because <c>shared/Observability</c> is referenced by every module's
/// <c>Domain</c> project and must not drag a broker client into them.
/// </para>
/// <para>
/// Kafka was chosen as the first transport for this because headers are <b>ignorable in both
/// directions</b>: an old consumer skips a header it does not read, and a new consumer treats an
/// absent header as "no parent", which is the pre-existing behavior. No rollout ordering is
/// required. The Redis and Postgres transports carry a bare payload, so propagating context there
/// would mean changing the wire format or the schema — deliberately not done here.
/// </para>
/// </remarks>
internal static class KafkaTraceContext
{
    /// <summary>
    /// Renders <paramref name="activity"/> into a fresh <see cref="Headers"/> collection.
    /// </summary>
    /// <returns>
    /// The headers, or <see langword="null"/> when there is no context to propagate. Returning null
    /// rather than an empty collection is deliberate: the produced message then stays byte-for-byte
    /// what an older producer would have written.
    /// </returns>
    public static Headers? Inject(Activity? activity)
    {
        if (!TraceContextPropagation.TryInject(activity, out var traceParent, out var traceState))
        {
            return null;
        }

        var headers = new Headers
        {
            { TraceContextPropagation.TraceParentHeader, Encoding.UTF8.GetBytes(traceParent) }
        };

        if (traceState is not null)
        {
            headers.Add(TraceContextPropagation.TraceStateHeader, Encoding.UTF8.GetBytes(traceState));
        }

        return headers;
    }

    /// <summary>
    /// Reads W3C trace context from a consumed message's headers.
    /// </summary>
    /// <returns>
    /// The producer's context, or <see langword="default"/> when the message carried none. A
    /// default context starts a fresh trace, so an un-instrumented producer degrades to the
    /// previous behavior rather than failing the consume.
    /// </returns>
    public static ActivityContext Extract(Headers? headers)
    {
        if (headers is null || headers.Count == 0)
        {
            return default;
        }

        return TraceContextPropagation.Extract(
            Read(TraceContextPropagation.TraceParentHeader),
            Read(TraceContextPropagation.TraceStateHeader));

        string? Read(string key)
        {
            // TryGetLastBytes, not TryGetBytes: Kafka permits repeated header keys, and W3C says
            // the last value wins.
            if (!headers.TryGetLastBytes(key, out var bytes) || bytes is null)
            {
                return null;
            }

            // Bounded before decoding, so a hostile producer cannot make this allocate a large
            // string. TraceContextPropagation re-checks the length, but refusing to decode at all
            // is cheaper than decoding and then discarding.
            return bytes.Length is 0 or > TraceContextPropagation.MaxHeaderLength
                ? null
                : Encoding.UTF8.GetString(bytes);
        }
    }
}

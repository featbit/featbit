#nullable enable

using System.Diagnostics;
using System.Diagnostics.Metrics;

namespace Domain.Observability;

/// <summary>
/// Per-request duration and outcome for a MediatR pipeline. Closes <b>F15</b>.
/// </summary>
/// <remarks>
/// <para>
/// This exists as a separate type rather than as statics on the pipeline behavior for one reason:
/// the behavior is a <i>generic</i> class, so <c>static readonly</c> instruments on it are created
/// once per closed generic type — dozens of times — and, worse, the meter name would be fixed at the
/// point the behavior's type is written. The back-end and the control plane both build MediatR
/// pipelines from the same <c>Application</c> assembly, so a hardcoded <c>FeatBit.Api</c> meter
/// would publish every control-plane command under <c>featbit.api.*</c> and silently attribute it
/// to the API server.
/// </para>
/// <para>
/// That misattribution is worse than the gap it fills — a metric that is confidently wrong costs
/// more during an incident than a metric that is absent — which is why F15 was deferred rather than
/// closed with a one-line registration.
/// </para>
/// <para>
/// <b>The request type is safe as an attribute.</b> It is a closed set fixed at compile time, one
/// series per command or query. The request's <i>contents</i> — flag keys, environment ids, user
/// identifiers — are never recorded.
/// </para>
/// </remarks>
public sealed class RequestMetrics
{
    private static RequestMetrics _current =
        new(new Meter(FeatBitMeters.Api), FeatBitInstruments.ApiPrefix);

    private readonly string _instrumentPrefix;

    private RequestMetrics(Meter meter, string instrumentPrefix)
    {
        Meter = meter;
        _instrumentPrefix = instrumentPrefix;

        Duration = meter.CreateHistogram<double>(
            $"{instrumentPrefix}request.duration",
            unit: "ms",
            description:
            "Duration of a MediatR request handler, by request type and outcome. Measures the " +
            "handler alone, unlike HTTP server metrics which also cover binding, auth, and " +
            "serialization.");

        Requests = meter.CreateCounter<long>(
            $"{instrumentPrefix}request.total",
            unit: "{request}",
            description:
            "MediatR requests by request type and outcome. outcome=validation_failed and " +
            "outcome=cancelled are counted apart from failure so client behavior cannot inflate " +
            "the server error rate.");
    }

    /// <summary>The instrumentation in use for the running service.</summary>
    public static RequestMetrics Current => _current;

    /// <summary>The owning meter. Exposed so tests can listen to this instance specifically.</summary>
    public Meter Meter { get; }

    /// <summary>Distribution of handler durations.</summary>
    public Histogram<double> Duration { get; }

    /// <summary>Counter of handled requests.</summary>
    public Counter<long> Requests { get; }

    /// <summary>
    /// Points the instrumentation at <paramref name="meterName"/> and
    /// <paramref name="instrumentPrefix"/>. Call once during startup, before any request is handled.
    /// </summary>
    public static void Configure(string meterName, string instrumentPrefix)
    {
        if (string.IsNullOrWhiteSpace(meterName) || string.IsNullOrWhiteSpace(instrumentPrefix))
        {
            return;
        }

        if (meterName == _current.Meter.Name && instrumentPrefix == _current._instrumentPrefix)
        {
            return;
        }

        var previous = _current;
        _current = new RequestMetrics(new Meter(meterName), instrumentPrefix);
        previous.Meter.Dispose();
    }

    /// <summary>Records one handled request.</summary>
    /// <param name="requestName">The request type name. Must be a type name, never request data.</param>
    /// <param name="outcome">One of <see cref="Outcomes"/> or one of the outcomes below.</param>
    /// <param name="duration">How long the handler took.</param>
    public void Record(string requestName, string outcome, TimeSpan duration)
    {
        var tags = new TagList
        {
            { ObservabilityTags.Operation, requestName },
            { ObservabilityTags.Outcome, outcome }
        };

        Duration.Record(duration.TotalMilliseconds, tags);
        Requests.Add(1, tags);
    }

    /// <summary>Outcome recorded when the request was rejected by validation.</summary>
    public const string ValidationFailedOutcome = "validation_failed";

    /// <summary>Outcome recorded when the request was canceled, usually by the caller.</summary>
    public const string CancelledOutcome = "cancelled";
}

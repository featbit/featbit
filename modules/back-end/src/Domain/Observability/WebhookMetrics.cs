#nullable enable

using System.Diagnostics.Metrics;

namespace Domain.Observability;

/// <summary>
/// M10 — outbound webhook delivery instrumentation.
/// </summary>
/// <remarks>
/// <para>
/// Webhooks are the only part of the product that makes outbound calls to an address a customer
/// controls, which makes them the part most likely to be slow, blocked, or broken — and the part
/// FeatBit can do least about. Delivery results are written to a per-webhook delivery log in the
/// database, which is fine for a customer debugging their own endpoint and useless for an operator
/// asking "are webhooks working right now?".
/// </para>
/// <para>
/// <b><see cref="Deliveries"/> and <see cref="Attempts"/> are separate on purpose.</b> A send makes
/// up to three attempts with a pause between them, so counting only attempts overstates failure
/// (two failed attempts followed by a success is a <i>successful</i> delivery) and counting only
/// deliveries hides a target that is failing most of the time but succeeding on retry. The ratio
/// between them is the early warning.
/// </para>
/// <para>
/// <b>The webhook URL, name, and ID are not recorded.</b> They are customer-supplied and unbounded,
/// and a URL frequently carries a secret in its path or query. They are already in the log line and
/// the delivery record, which is where per-webhook debugging belongs.
/// </para>
/// <para>
/// <b><see cref="WebhookReasons.Blocked"/> is called out separately from an ordinary failure</b>
/// because it is not a customer problem: it means the anti-SSRF policy refused the target. That is
/// a security control firing, and it should be visible as such rather than buried in a generic
/// error rate.
/// </para>
/// </remarks>
public sealed class WebhookMetrics
{
    private WebhookMetrics(Meter meter, string instrumentPrefix)
    {
        Meter = meter;

        Deliveries = meter.CreateCounter<long>(
            $"{instrumentPrefix}webhook.deliveries",
            unit: "{delivery}",
            description:
            "Webhook sends by final outcome, after all retries. One per triggering change, not per " +
            "HTTP attempt.");

        Attempts = meter.CreateCounter<long>(
            $"{instrumentPrefix}webhook.attempts",
            unit: "{attempt}",
            description:
            "Individual webhook HTTP attempts by outcome. Compare with deliveries to see targets " +
            "that are only succeeding on retry.");

        AttemptDuration = meter.CreateHistogram<double>(
            $"{instrumentPrefix}webhook.attempt_duration",
            unit: "ms",
            description:
            "Duration of one webhook HTTP attempt. Bounded by the client timeout, so a cluster at " +
            "the timeout value means an unresponsive target rather than a slow one.");
    }

    /// <summary>The instrumentation in use for the running service.</summary>
    public static WebhookMetrics Current { get; } =
        new(new Meter(FeatBitMeters.Api), FeatBitInstruments.ApiPrefix);

    /// <summary>The owning meter. Exposed so tests can listen to this instance specifically.</summary>
    public Meter Meter { get; }

    /// <summary>Counter of webhook sends by final outcome.</summary>
    public Counter<long> Deliveries { get; }

    /// <summary>Counter of individual HTTP attempts.</summary>
    public Counter<long> Attempts { get; }

    /// <summary>Distribution of per-attempt durations.</summary>
    public Histogram<double> AttemptDuration { get; }

    /// <summary>Records the final result of a webhook send.</summary>
    /// <param name="outcome">One of <see cref="Outcomes"/>.</param>
    /// <param name="reason">One of <see cref="WebhookReasons"/>.</param>
    public void RecordDelivery(string outcome, string reason) =>
        Deliveries.Add(
            1,
            new KeyValuePair<string, object?>(ObservabilityTags.Outcome, outcome),
            new KeyValuePair<string, object?>(ObservabilityTags.Reason, reason));

    /// <summary>Records one HTTP attempt.</summary>
    /// <param name="outcome">One of <see cref="Outcomes"/>.</param>
    /// <param name="reason">One of <see cref="WebhookReasons"/>.</param>
    /// <param name="duration">How long the attempt took.</param>
    public void RecordAttempt(string outcome, string reason, TimeSpan duration)
    {
        var tags = new[]
        {
            new KeyValuePair<string, object?>(ObservabilityTags.Outcome, outcome),
            new KeyValuePair<string, object?>(ObservabilityTags.Reason, reason)
        };

        Attempts.Add(1, tags);
        AttemptDuration.Record(duration.TotalMilliseconds, tags);
    }
}

/// <summary>The fixed <c>reason</c> vocabulary for <see cref="WebhookMetrics"/>.</summary>
public static class WebhookReasons
{
    /// <summary>The target accepted the delivery.</summary>
    public const string Delivered = "delivered";

    /// <summary>
    /// The payload template could not be rendered into valid JSON. A configuration error on the
    /// FeatBit side, not the target's — nothing was ever sent.
    /// </summary>
    public const string TemplateError = "template_error";

    /// <summary>
    /// The rendered payload was an empty object and the webhook is configured to suppress those.
    /// A deliberate skip rather than a failure.
    /// </summary>
    public const string EmptyPayload = "empty_payload";

    /// <summary>
    /// The anti-SSRF policy refused the target address. A security control firing, kept distinct
    /// from a transport failure so it can be alerted on separately.
    /// </summary>
    public const string Blocked = "blocked";

    /// <summary>The target answered with a non-success status code.</summary>
    public const string HttpError = "http_error";

    /// <summary>The attempt threw — DNS, TLS, connection, or timeout.</summary>
    public const string TransportError = "transport_error";
}

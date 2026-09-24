#nullable enable

using System.Diagnostics.Metrics;

namespace Domain.Observability;

/// <summary>
/// M6 — rate-limiting instrumentation for the evaluation server's public endpoints.
/// </summary>
/// <remarks>
/// <para>
/// <b><see cref="Outcomes.FailOpen"/> is recorded separately from an ordinary allow, and this is
/// the whole point of the instrument.</b> When Redis is unreachable the limiter allows the request
/// through. That is the right behavior, but it means the service is silently unprotected: request
/// counts look normal, error rates look normal, and the only symptom is a Warning log line. A
/// distinct outcome turns "rate limiting has stopped working" into something that can be alerted on
/// directly. The fail-open path itself is left exactly as it is.
/// </para>
/// <para>
/// <b>Partition keys are never recorded.</b> They are derived from caller-supplied values such as
/// SDK keys and client addresses, so using one as an attribute would make cardinality unbounded and
/// leak a credential into the metrics pipeline. Only the policy name is recorded, which is drawn
/// from a fixed set.
/// </para>
/// </remarks>
public sealed class RateLimitMetrics
{
    private RateLimitMetrics(Meter meter, string instrumentPrefix)
    {
        Meter = meter;

        Decisions = meter.CreateCounter<long>(
            $"{instrumentPrefix}rate_limit.decisions",
            unit: "{decision}",
            description:
            "Rate-limit decisions by policy and outcome. outcome=fail_open means the limiter could " +
            "not reach Redis and allowed the request, so the endpoint was unprotected.");

        Duration = meter.CreateHistogram<double>(
            $"{instrumentPrefix}rate_limit.duration",
            unit: "ms",
            description:
            "Time spent evaluating a rate-limit decision, by policy and outcome. This is latency " +
            "added to every request on the endpoint, so a regression here is a user-visible one.");
    }

    /// <summary>The instrumentation in use for the running service.</summary>
    public static RateLimitMetrics Current { get; } =
        new(new Meter(FeatBitMeters.EvaluationServer), FeatBitInstruments.EvaluationServerPrefix);

    /// <summary>The owning meter. Exposed so tests can listen to this instance specifically.</summary>
    public Meter Meter { get; }

    /// <summary>Counter of rate-limit decisions.</summary>
    public Counter<long> Decisions { get; }

    /// <summary>Distribution of rate-limit evaluation durations.</summary>
    public Histogram<double> Duration { get; }

    /// <summary>Records one rate-limit decision.</summary>
    /// <param name="policy">The limiter policy name, from a fixed set.</param>
    /// <param name="outcome">
    /// <see cref="Outcomes.Success"/> for an allow, <see cref="Outcomes.Rejected"/> for a denial, or
    /// <see cref="Outcomes.FailOpen"/> when the backing store was unreachable.
    /// </param>
    /// <param name="duration">How long the decision took.</param>
    public void RecordDecision(string policy, string outcome, TimeSpan duration)
    {
        var tags = new[]
        {
            new KeyValuePair<string, object?>(ObservabilityTags.Operation, policy),
            new KeyValuePair<string, object?>(ObservabilityTags.Outcome, outcome)
        };

        Decisions.Add(1, tags);
        Duration.Record(duration.TotalMilliseconds, tags);
    }
}

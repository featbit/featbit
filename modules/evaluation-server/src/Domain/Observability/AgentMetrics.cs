#nullable enable

using System.Diagnostics.Metrics;

namespace Domain.Observability;

/// <summary>
/// Relay-proxy agent registration instrumentation.
/// </summary>
/// <remarks>
/// <para>
/// A FeatBit Agent registers over HTTP before it can stream. That endpoint has three ways to turn
/// an agent away — an unrecognized key, an exhausted workspace quota, and an unhandled exception —
/// and all three previously returned a bare status code with no signal behind them. A fleet of
/// agents silently failing to register looks, from every dashboard, exactly like a fleet that was
/// never deployed.
/// </para>
/// <para>
/// <b>Quota rejection is the reason this exists.</b> It is the one failure here that is not a bug:
/// it is working as designed, it is invisible in error logs because nothing throws, and it is
/// resolved by a conversation about licensing rather than by an engineer reading a stack trace.
/// Separating it from <c>unauthorized</c> is what makes that distinction possible without
/// correlating by hand.
/// </para>
/// <para>
/// The agent ID and the authorization key are deliberately absent. The key is a credential, and the
/// agent ID is caller-supplied on an <c>[AllowAnonymous]</c> endpoint — tagging either would let an
/// unauthenticated caller mint unbounded metric series. Both are already available in the
/// correlated log line, which has a narrower audience than the metrics backend.
/// </para>
/// </remarks>
public sealed class AgentMetrics
{
    private AgentMetrics(Meter meter, string instrumentPrefix)
    {
        Meter = meter;

        Registrations = meter.CreateCounter<long>(
            $"{instrumentPrefix}agent.registrations",
            unit: "{registration}",
            description:
            "Relay-proxy agent registration attempts, by outcome and reason. Agents re-register on " +
            "restart, so a sustained rate is normal and a sudden change of outcome mix is the signal.");
    }

    /// <summary>The instrumentation in use for the running service.</summary>
    public static AgentMetrics Current { get; } =
        new(new Meter(FeatBitMeters.EvaluationServer), FeatBitInstruments.EvaluationServerPrefix);

    /// <summary>The owning meter. Exposed so tests can listen to this instance specifically.</summary>
    public Meter Meter { get; }

    /// <summary>Counter of agent registration attempts.</summary>
    public Counter<long> Registrations { get; }

    /// <summary>Records one agent registration attempt.</summary>
    /// <param name="outcome">One of <see cref="Outcomes"/>.</param>
    /// <param name="reason">One of <see cref="AgentReasons"/>.</param>
    public void RecordRegistration(string outcome, string reason) =>
        Registrations.Add(
            1,
            new KeyValuePair<string, object?>(ObservabilityTags.Outcome, outcome),
            new KeyValuePair<string, object?>(ObservabilityTags.Reason, reason));
}

/// <summary>
/// The bounded <c>reason</c> vocabulary for <see cref="AgentMetrics"/>.
/// </summary>
public static class AgentReasons
{
    /// <summary>The agent registered successfully.</summary>
    public const string Registered = "registered";

    /// <summary>The authorization key did not resolve to a workspace.</summary>
    public const string Unauthorized = "unauthorized";

    /// <summary>The workspace resolved but has no remaining relay-proxy quota.</summary>
    public const string QuotaExceeded = "quota_exceeded";

    /// <summary>Registration threw. The exception type is on the log record, not the metric.</summary>
    public const string Error = "error";
}

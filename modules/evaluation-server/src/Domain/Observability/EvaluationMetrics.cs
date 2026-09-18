#nullable enable

using System.Diagnostics.Metrics;

namespace Domain.Observability;

/// <summary>
/// M9 — flag evaluation instrumentation.
/// </summary>
/// <remarks>
/// <para>
/// Evaluation is the evaluation server's reason to exist, and before this it was the single
/// largest blind spot in the estate: <c>Domain/Evaluation/</c> contained no instrument, no span,
/// and not one <c>ILogger</c>. A pod that evaluated every flag to the wrong variation, or that
/// silently skipped every malformed flag, looked identical to a healthy one at every other layer.
/// </para>
/// <para>
/// <b><c>reason</c> is derived from the variation <i>type</i>, never from
/// <c>UserVariation.MatchReason</c>.</b> That property carries the user-authored rule name for a
/// rollout match, so tagging with it would put customer-defined strings — unbounded, and arguably
/// customer data — straight into a metric dimension. The type hierarchy answers the same
/// operational question ("why did users get the variation they got?") with a fixed five-value
/// vocabulary. See <see cref="EvaluationReasons"/>.
/// </para>
/// <para>
/// <b>No flag key, environment, or user identifier is recorded.</b> Those are the three
/// highest-cardinality values in the product and all three are attached to every evaluation, so
/// this is where the cardinality budget in <c>docs/observability/index.md</c> §4 would be blown
/// first. "Which flag is failing?" is a logs-and-traces question; this is the rate-and-latency
/// signal that tells you to go and ask it.
/// </para>
/// <para>
/// <b>Malformed entities are counted, not just logged.</b> <c>DataSyncService</c> deliberately
/// skips a flag it cannot parse so that one bad flag cannot fail an entire client's data sync.
/// That is the right behaviour and is unchanged — but it means a corrupt flag silently disappears
/// from every payload. The counter makes the skip rate alertable.
/// </para>
/// </remarks>
public sealed class EvaluationMetrics
{
    private EvaluationMetrics(Meter meter, string instrumentPrefix)
    {
        Meter = meter;

        Evaluations = meter.CreateCounter<long>(
            $"{instrumentPrefix}evaluation.evaluations",
            unit: "{evaluation}",
            description:
            "Flag evaluations by outcome and match reason. reason is derived from the variation " +
            "type, so it stays within a fixed vocabulary rather than carrying user-authored rule names.");

        Duration = meter.CreateHistogram<double>(
            $"{instrumentPrefix}evaluation.duration",
            unit: "ms",
            description:
            "Duration of a single flag evaluation, including rule and segment matching. Segment " +
            "matching can reach the store, so this is not purely CPU-bound.");

        MalformedEntities = meter.CreateCounter<long>(
            $"{instrumentPrefix}evaluation.malformed_entities",
            unit: "{entity}",
            description:
            "Entities skipped during evaluation because they could not be parsed. The affected flag " +
            "is omitted from the client payload rather than failing the sync, so this is otherwise invisible.");
    }

    /// <summary>The instrumentation in use for the running service.</summary>
    public static EvaluationMetrics Current { get; } =
        new(new Meter(FeatBitMeters.EvaluationServer), FeatBitInstruments.EvaluationServerPrefix);

    /// <summary>The owning meter. Exposed so tests can listen to this instance specifically.</summary>
    public Meter Meter { get; }

    /// <summary>Counter of flag evaluations.</summary>
    public Counter<long> Evaluations { get; }

    /// <summary>Distribution of single-evaluation durations.</summary>
    public Histogram<double> Duration { get; }

    /// <summary>Counter of entities skipped because they were malformed.</summary>
    public Counter<long> MalformedEntities { get; }

    /// <summary>
    /// True when at least one instrument on this type has a listener. Callers use this to skip
    /// timestamp capture on the evaluation hot path when nothing is collecting.
    /// </summary>
    public bool Enabled => Evaluations.Enabled || Duration.Enabled;

    /// <summary>Records one completed evaluation.</summary>
    /// <param name="reason">One of <see cref="EvaluationReasons"/>.</param>
    /// <param name="outcome">One of <see cref="Outcomes"/>.</param>
    /// <param name="duration">How long the evaluation took.</param>
    public void RecordEvaluation(string reason, string outcome, TimeSpan duration)
    {
        var tags = new[]
        {
            new KeyValuePair<string, object?>(ObservabilityTags.Outcome, outcome),
            new KeyValuePair<string, object?>(ObservabilityTags.Reason, reason)
        };

        Evaluations.Add(1, tags);
        Duration.Record(duration.TotalMilliseconds, tags);
    }

    /// <summary>Records one entity skipped because it could not be parsed.</summary>
    /// <param name="resourceType">The entity kind, e.g. <c>feature-flag</c> or <c>segment</c>.</param>
    public void RecordMalformedEntity(string resourceType) =>
        MalformedEntities.Add(
            1, new KeyValuePair<string, object?>(ObservabilityTags.ResourceType, resourceType));
}

/// <summary>
/// The fixed vocabulary for the <c>reason</c> dimension of
/// <see cref="EvaluationMetrics.Evaluations"/>.
/// </summary>
/// <remarks>
/// These map one-to-one onto the <c>UserVariation</c> subclasses rather than onto
/// <c>UserVariation.MatchReason</c>, which is a user-authored rule name for rollout matches and is
/// therefore unbounded. <see cref="RuleMatch"/> and <see cref="Fallthrough"/> both come from
/// <c>RolloutUserVariation</c> and are told apart by the sentinel rule name the evaluator uses for
/// the default rule.
/// </remarks>
public static class EvaluationReasons
{
    /// <summary>The flag is archived, so no variation was served.</summary>
    public const string Archived = "archived";

    /// <summary>The flag is turned off; the configured off-variation was served.</summary>
    public const string Disabled = "disabled";

    /// <summary>The user was individually targeted.</summary>
    public const string Targeted = "targeted";

    /// <summary>A targeting rule matched and its rollout selected the variation.</summary>
    public const string RuleMatch = "rule_match";

    /// <summary>No rule matched; the default rule's rollout selected the variation.</summary>
    public const string Fallthrough = "fallthrough";

    /// <summary>The flag or a segment it references could not be parsed.</summary>
    public const string MalformedData = "malformed_data";

    /// <summary>Evaluation threw for any other reason.</summary>
    public const string Error = "error";
}

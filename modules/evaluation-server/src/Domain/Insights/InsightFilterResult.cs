namespace Domain.Insights;

/// <summary>
/// Outcome of removing evaluations of flags with insights disabled from an <see cref="Insight"/>.
/// </summary>
/// <param name="Skip">
/// True when the insight had flag evaluations, all of them were dropped, and it carries no metrics: nothing
/// about it (including its end user) may be recorded.
/// </param>
/// <param name="DroppedFlagKeys">Keys of the dropped evaluations, one entry per dropped evaluation.</param>
public readonly record struct InsightFilterResult(bool Skip, IReadOnlyList<string> DroppedFlagKeys)
{
    public static readonly InsightFilterResult Unchanged = new(false, []);
}

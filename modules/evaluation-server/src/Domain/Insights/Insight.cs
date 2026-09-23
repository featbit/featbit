using Domain.EndUsers;

namespace Domain.Insights;

public class Insight
{
    public EndUser? User { get; set; }

    public VariationInsight?[]? Variations { get; set; } = [];

    public MetricInsight?[]? Metrics { get; set; } = [];

    public bool IsValid()
    {
        if (User == null || !User.IsValid())
        {
            return false;
        }

        if (Variations is not null && Variations.Any(x => x is null || !x.IsValid()))
        {
            return false;
        }

        if (Metrics is not null && Metrics.Any(x => x is null || !x.IsValid()))
        {
            return false;
        }

        return true;
    }

    /// <summary>
    /// Removes evaluations of flags whose insights are disabled. Call only on a valid insight.
    /// Does not allocate when no evaluation is dropped.
    /// </summary>
    public InsightFilterResult FilterDisabledFlags(Func<string, bool> isDisabled)
    {
        if (Variations is not { Length: > 0 })
        {
            return InsightFilterResult.Unchanged;
        }

        List<string>? dropped = null;
        List<VariationInsight?>? retained = null;
        for (var i = 0; i < Variations.Length; i++)
        {
            var variation = Variations[i];
            if (isDisabled(variation!.FeatureFlagKey!))
            {
                if (dropped is null)
                {
                    dropped = [];
                    retained = [..Variations[..i]];
                }

                dropped.Add(variation.FeatureFlagKey!);
            }
            else
            {
                retained?.Add(variation);
            }
        }

        if (dropped is null)
        {
            return InsightFilterResult.Unchanged;
        }

        Variations = retained!.ToArray();
        var skip = Variations.Length == 0 && Metrics is not { Length: > 0 };
        return new InsightFilterResult(skip, dropped);
    }

    public EndUserMessage EndUserMessage(Guid envId)
    {
        return new EndUserMessage(envId, User!);
    }

    public void AppendInsightMessages(string envId, ICollection<InsightMessage> messages)
    {
        // flag messages
        if (Variations != null)
        {
            foreach (var variation in Variations)
            {
                if (variation?.Variation == null)
                {
                    continue;
                }

                messages.Add(InsightMessage.ForFlagValue(envId, User!, variation));
            }
        }

        // metric messages
        if (Metrics != null)
        {
            foreach (var metric in Metrics)
            {
                if (metric is null)
                {
                    continue;
                }

                messages.Add(InsightMessage.ForMetric(envId, User!, metric));
            }
        }

    }
}

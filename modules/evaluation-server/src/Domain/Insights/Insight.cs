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

    public EndUserMessage EndUserMessage(Guid envId)
    {
        return new EndUserMessage(envId, User!);
    }

    public ICollection<InsightMessage> InsightMessages(Guid envId)
    {
        var messages = new List<InsightMessage>();
        var envIdString = $"{envId}";

        // flag messages
        if (Variations != null)
        {
            foreach (var variation in Variations)
            {
                if (variation?.Variation == null)
                {
                    continue;
                }

                messages.Add(InsightMessage.ForFlagValue(envIdString, User, variation));
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

                messages.Add(InsightMessage.ForMetric(envIdString, User, metric));
            }
        }

        return messages;
    }
}

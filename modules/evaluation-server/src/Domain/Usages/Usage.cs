using Domain.Insights;

namespace Domain.Usages;

public class UsageTypes
{
    public const string Insight = "insight";
}

public abstract class Usage
{
    public Guid EnvId { get; }

    public abstract string Type { get; }

    public Usage(Guid envId)
    {
        EnvId = envId;
    }
}

public class InsightUsage : Usage
{
    public override string Type => UsageTypes.Insight;

    public List<string> EndUsers { get; set; }

    public int FlagEvaluations { get; set; }

    public int CustomMetrics { get; set; }

    public InsightUsage(Guid envId) : base(envId)
    {
        EndUsers = [];
        FlagEvaluations = 0;
        CustomMetrics = 0;
    }

    public void AddInsight(Insight insight)
    {
        if (insight.User != null)
        {
            EndUsers.Add(insight.User.KeyId);
        }

        FlagEvaluations += insight.Variations.Length;
        CustomMetrics += insight.Metrics.Length;
    }
}
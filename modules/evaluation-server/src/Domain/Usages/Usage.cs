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

    public HashSet<string> EndUsers { get; set; }

    public int FlagEvaluations { get; set; }

    public int CustomMetrics { get; set; }

    public InsightUsage(Guid envId) : base(envId)
    {
        EndUsers = [];
        FlagEvaluations = 0;
        CustomMetrics = 0;
    }

    public void AddUser(string userKeyId) => EndUsers.Add(userKeyId);

    public void AddEvents(int flagEvaluations, int customMetrics)
    {
        FlagEvaluations += flagEvaluations;
        CustomMetrics += customMetrics;
    }
}
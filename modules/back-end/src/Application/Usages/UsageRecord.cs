namespace Application.Usages;

public abstract record UsageRecord(Guid EnvId);

public record InsightsUsageRecord(Guid EnvId, string[] EndUsers, int FlagEvaluations, int CustomMetrics)
    : UsageRecord(EnvId);
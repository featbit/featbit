namespace Application.Usages;

public abstract record UsageRecord(Guid EnvId, DateOnly RecordedAt);

public record InsightsUsageRecord(
    Guid EnvId,
    DateOnly RecordedAt,
    string[] EndUsers,
    int FlagEvaluations,
    int CustomMetrics) : UsageRecord(EnvId, RecordedAt);
namespace Application.Workspaces;

public record WorkspaceUsageVm(
    UsageSummaryVm Summary,
    ICollection<DailyTrendItemVm> DailyTrend,
    ICollection<EnvironmentUsageVm> EnvironmentUsages
);

public record UsageSummaryVm(
    int UniqueUsers,
    long TotalFlagEvaluations,
    long TotalCustomMetrics,
    int PrevUniqueUsers,
    long PrevFlagEvaluations,
    long PrevCustomMetrics
);

public record DailyTrendItemVm(
    DateOnly Date,
    int NewUsers,
    long FlagEvaluations,
    long CustomMetrics
);

public record EnvironmentUsageVm(
    string OrgName,
    string ProjectName,
    string EnvName,
    Guid EnvId,
    int UniqueUsers,
    long FlagEvaluations,
    long CustomMetrics
);
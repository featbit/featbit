namespace Application.Workspaces;

public record WorkspaceUsageVm(
    UsageSummaryVm Summary,
    ICollection<DailyTrendItemVm> DailyTrend,
    ICollection<EnvironmentUsageVm> EnvironmentUsages
);

public record UsageSummaryVm(
    int Mau,
    long TotalFlagEvaluations,
    long TotalCustomMetrics,
    int PrevMau,
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
    int Mau,
    long FlagEvaluations,
    long CustomMetrics
);
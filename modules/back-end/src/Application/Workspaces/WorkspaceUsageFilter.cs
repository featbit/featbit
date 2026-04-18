namespace Application.Workspaces;

public record WorkspaceUsageFilter(
    DateOnly StartDate,
    DateOnly EndDate,
    DateOnly PrevStartDate,
    DateOnly PrevEndDate
);
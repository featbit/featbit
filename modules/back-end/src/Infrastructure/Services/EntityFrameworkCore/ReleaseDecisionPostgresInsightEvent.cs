namespace Infrastructure.Services.EntityFrameworkCore;

internal sealed record ReleaseDecisionPostgresInsightEvent(
    Guid Id,
    string? DistinctId,
    string? EnvId,
    string? EventName,
    string? Properties,
    DateTimeOffset Timestamp);

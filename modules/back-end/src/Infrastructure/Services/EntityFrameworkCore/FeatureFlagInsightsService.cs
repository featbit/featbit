using Application.FeatureFlags;
using Dapper;
using Domain.FeatureFlags;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Services.EntityFrameworkCore;

public class FeatureFlagInsightsService(AppDbContext dbContext) : IFeatureFlagInsightsService
{
    public async Task<ICollection<Insights>> GetFeatureFlagInsightsAsync(Guid envId, StatsByVariationFilter filter)
    {
        var bucket = GetBucketExpression(filter.IntervalType);
        var from = ToUnspecifiedUtcDateTime(filter.From);
        var to = ToUnspecifiedUtcDateTime(filter.To);

        var sql = $"""
            SELECT
                {bucket} AS Bucket,
                properties->>'tag_1' AS VariationId,
                count(*)::int AS Count
            FROM events
            WHERE env_id = @EnvId
              AND distinct_id = @FlagExptId
              AND event = 'FlagValue'
              AND timestamp >= @From
              AND timestamp <= @To
              AND properties->>'tag_2' = 'true'
              AND properties->>'tag_1' IS NOT NULL
            GROUP BY Bucket, VariationId
            ORDER BY Bucket
            """;

        var rows = await dbContext.Database.GetDbConnection().QueryAsync<InsightRow>(
            sql,
            new
            {
                EnvId = envId.ToString(),
                FlagExptId = $"{envId}-{filter.FeatureFlagKey}",
                From = from,
                To = to
            });

        return rows
            .GroupBy(x => x.Bucket)
            .Select(group => new Insights
            {
                Time = DateTime.SpecifyKind(group.Key, DateTimeKind.Utc).ToString("O"),
                Variations = group
                    .Select(x => new VariationInsights { Id = x.VariationId, Val = x.Count })
                    .ToArray()
            })
            .ToArray();
    }

    private static string GetBucketExpression(string intervalType)
    {
        return intervalType switch
        {
            IntervalType.Month => "date_trunc('month', timestamp)",
            IntervalType.Week => "date_trunc('week', timestamp)",
            IntervalType.Day => "date_trunc('day', timestamp)",
            IntervalType.Hour => "date_trunc('hour', timestamp)",
            IntervalType.Minute => "date_trunc('minute', timestamp)",
            _ => throw new ArgumentException($"Unsupported interval type: {intervalType}", nameof(intervalType))
        };
    }

    private static DateTime ToUnspecifiedUtcDateTime(long unixMilliseconds)
    {
        var utc = DateTimeOffset.FromUnixTimeMilliseconds(unixMilliseconds).UtcDateTime;
        return DateTime.SpecifyKind(utc, DateTimeKind.Unspecified);
    }

    private sealed class InsightRow
    {
        public DateTime Bucket { get; init; }
        public string VariationId { get; init; } = string.Empty;
        public int Count { get; init; }
    }
}

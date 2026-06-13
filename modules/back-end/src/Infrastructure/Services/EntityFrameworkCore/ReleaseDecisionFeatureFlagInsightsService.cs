using Application.FeatureFlags;
using Dapper;
using Domain.FeatureFlags;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Services.EntityFrameworkCore;

public class ReleaseDecisionFeatureFlagInsightsService(AppDbContext dbContext) : IFeatureFlagInsightsService
{
    public async Task<ICollection<Insights>> GetFeatureFlagInsightsAsync(Guid envId, StatsByVariationFilter filter)
    {
        var bucket = GetBucketExpression(filter.IntervalType);
        var from = DateTimeOffset.FromUnixTimeMilliseconds(filter.From);
        var to = DateTimeOffset.FromUnixTimeMilliseconds(filter.To);

        var sql = $"""
            SELECT
                {bucket} AS Bucket,
                variation_id AS VariationId,
                count(*)::int AS Count
            FROM release_decision_exposure_events
            WHERE env_id = @EnvId
              AND flag_key = @FeatureFlagKey
              AND exposed_at >= @From
              AND exposed_at <= @To
              AND variation_id IS NOT NULL
            GROUP BY Bucket, VariationId
            ORDER BY Bucket
            """;

        var rows = await dbContext.Database.GetDbConnection().QueryAsync<InsightRow>(
            sql,
            new
            {
                EnvId = envId,
                filter.FeatureFlagKey,
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
            IntervalType.Month => "date_trunc('month', exposed_at)",
            IntervalType.Week => "date_trunc('week', exposed_at)",
            IntervalType.Day => "date_trunc('day', exposed_at)",
            IntervalType.Hour => "date_trunc('hour', exposed_at)",
            IntervalType.Minute => "date_trunc('minute', exposed_at)",
            _ => throw new ArgumentException($"Unsupported interval type: {intervalType}", nameof(intervalType))
        };
    }

    private sealed class InsightRow
    {
        public DateTime Bucket { get; init; }
        public string VariationId { get; init; } = string.Empty;
        public int Count { get; init; }
    }
}

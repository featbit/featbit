using Application.FeatureFlags;
using Application.Insights;
using Infrastructure.OLAP.ClickHouse;

namespace Infrastructure.Services.ClickHouse;

public class InsightService(ClickHouseClient clickHouse) : IInsightService
{
    public Task AddManyAsync(object[] insights)
    {
        // In Kafka deployments, ClickHouse consumes `featbit-insights` through its Kafka-engine table and materialized view
        // So this method should never be called
        throw new NotImplementedException();
    }

    public async Task<ICollection<Insight>> GetInsightsAsync(Guid envId, InsightFilter filter)
    {
        var bucket = GetBucketExpression(filter.IntervalType);
        var from = DateTimeOffset.FromUnixTimeMilliseconds(filter.From);
        var to = DateTimeOffset.FromUnixTimeMilliseconds(filter.To);

        var sql = $"""
            SELECT
                toInt64(toUnixTimestamp({bucket})) * 1000 AS BucketMs,
                variation_id AS VariationId,
                toInt32(count()) AS Count
            FROM experiment_exposure_events
            WHERE env_id = {ClickHouseSql.Uuid(envId)}
              AND flag_key = {ClickHouseSql.String(filter.FeatureFlagKey)}
              AND exposed_at >= {ClickHouseSql.DateTime64(from)}
              AND exposed_at <= {ClickHouseSql.DateTime64(to)}
              AND notEmpty(variation_id)
            GROUP BY BucketMs, VariationId
            ORDER BY BucketMs
            """;

        var rows = await clickHouse.QueryAsync<InsightRow>(sql);

        return rows
            .GroupBy(x => x.BucketMs)
            .Select(group => new Insight
            {
                Time = DateTimeOffset.FromUnixTimeMilliseconds(group.Key).UtcDateTime.ToString("O"),
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
            IntervalType.Month => "toStartOfMonth(exposed_at)",
            IntervalType.Week => "toMonday(exposed_at)",
            IntervalType.Day => "toStartOfDay(exposed_at)",
            IntervalType.Hour => "toStartOfHour(exposed_at)",
            IntervalType.Minute => "toStartOfMinute(exposed_at)",
            _ => throw new ArgumentException($"Unsupported interval type: {intervalType}", nameof(intervalType))
        };
    }

    private sealed class InsightRow
    {
        public long BucketMs { get; init; }
        public string VariationId { get; init; } = string.Empty;
        public int Count { get; init; }
    }
}

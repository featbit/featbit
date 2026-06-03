using Application.ExperimentStats;
using Dapper;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Services.EntityFrameworkCore;

public class ExperimentStatsService(AppDbContext dbContext) : IExperimentStatsService
{
    public async Task<ExperimentStatsVm> QueryAsync(QueryExperimentStats request)
    {
        var start = ToUnspecifiedUtcDateTime(DateOnly.ParseExact(request.StartDate, "yyyy-MM-dd"));
        var end = ToUnspecifiedUtcDateTime(DateOnly.ParseExact(request.EndDate, "yyyy-MM-dd").AddDays(1));
        var contribution = GetUserContributionExpression(request.MetricType, request.MetricAgg);

        var sql = $"""
            WITH first_eval AS
            (
                SELECT
                    user_key,
                    (array_agg(variation ORDER BY timestamp))[1] AS variant,
                    min(timestamp) AS exposure_ts
                FROM
                (
                    SELECT
                        properties->>'tag_0' AS user_key,
                        properties->>'tag_1' AS variation,
                        timestamp
                    FROM events
                    WHERE env_id = @EnvId
                      AND distinct_id = @FlagExptId
                      AND event = 'FlagValue'
                      AND timestamp >= @StartTime
                      AND timestamp < @EndTime
                      AND properties->>'tag_2' = 'true'
                      AND properties->>'tag_0' IS NOT NULL
                      AND properties->>'tag_1' IS NOT NULL
                ) flag_events
                GROUP BY user_key
            ),
            metric_events AS
            (
                SELECT
                    m.properties->>'tag_0' AS user_key,
                    CASE
                        WHEN jsonb_typeof(m.properties->'numericValue') = 'number'
                            THEN (m.properties->>'numericValue')::double precision
                        WHEN (m.properties->>'tag_1') ~ '^-?[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?$'
                            THEN (m.properties->>'tag_1')::double precision
                        ELSE 0
                    END AS numeric_value
                FROM events m
                INNER JOIN first_eval fe ON fe.user_key = m.properties->>'tag_0'
                WHERE m.env_id = @EnvId
                  AND m.distinct_id = @MetricEvent
                  AND m.timestamp >= @StartTime
                  AND m.timestamp < @EndTime
                  AND m.timestamp >= fe.exposure_ts
            ),
            user_totals AS
            (
                SELECT
                    user_key,
                    count(*) AS conv_count,
                    sum(numeric_value) AS user_sum,
                    avg(numeric_value) AS user_avg
                FROM metric_events
                GROUP BY user_key
            )
            SELECT
                fe.variant AS Variant,
                count(*)::bigint AS Users,
                count(*) FILTER (WHERE coalesce(ut.conv_count, 0) > 0)::bigint AS Conversions,
                sum({contribution})::double precision AS SumValue,
                sum(({contribution}) * ({contribution}))::double precision AS SumSquares
            FROM first_eval fe
            LEFT JOIN user_totals ut ON ut.user_key = fe.user_key
            GROUP BY fe.variant
            ORDER BY fe.variant
            """;

        var rows = (await dbContext.Database.GetDbConnection().QueryAsync<ExperimentVariantStatsVm>(
            sql,
            new
            {
                EnvId = request.EnvId.ToString(),
                FlagExptId = $"{request.EnvId}-{request.FlagKey}",
                request.MetricEvent,
                StartTime = start,
                EndTime = end
            })).ToArray();

        foreach (var row in rows)
        {
            row.ConversionRate = row.Users == 0 ? 0 : (double)row.Conversions / row.Users;
            row.AvgValue = row.Users == 0 ? 0 : row.SumValue / row.Users;
        }

        return new ExperimentStatsVm
        {
            EnvId = request.EnvId,
            FlagKey = request.FlagKey,
            MetricEvent = request.MetricEvent,
            Window = new ExperimentStatsWindowVm
            {
                Start = request.StartDate,
                End = request.EndDate
            },
            Variants = rows
        };
    }

    private static string GetUserContributionExpression(string metricType, string metricAgg)
    {
        var normalizedAgg = metricType == "binary" ? "once" : metricAgg;

        return normalizedAgg switch
        {
            "once" => "CASE WHEN coalesce(ut.conv_count, 0) > 0 THEN 1.0 ELSE 0.0 END",
            "count" => "coalesce(ut.conv_count, 0)::double precision",
            "sum" => "coalesce(ut.user_sum, 0)",
            "average" => "coalesce(ut.user_avg, 0)",
            _ => throw new ArgumentException($"Unsupported metric aggregation: {metricAgg}", nameof(metricAgg))
        };
    }

    private static DateTime ToUnspecifiedUtcDateTime(DateOnly date)
    {
        return DateTime.SpecifyKind(date.ToDateTime(TimeOnly.MinValue), DateTimeKind.Unspecified);
    }
}

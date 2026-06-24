using Application.ExperimentStats;
using Dapper;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Services.EntityFrameworkCore;

public class ReleaseDecisionExperimentStatsService(AppDbContext dbContext) : IExperimentStatsService
{
    public async Task<ExperimentStatsVm> QueryAsync(QueryExperimentStats request)
    {
        var start = ToUnspecifiedUtcDateTime(DateOnly.ParseExact(request.StartDate, "yyyy-MM-dd"));
        var end = ToUnspecifiedUtcDateTime(DateOnly.ParseExact(request.EndDate, "yyyy-MM-dd").AddDays(1));
        var contribution = GetUserContributionExpression(request.MetricType, request.MetricAgg);
        var trafficScope = GetTrafficScope(request);

        var sql = $"""
            WITH exposure_source AS MATERIALIZED
            (
                SELECT
                    user_key,
                    variation_id,
                    exposed_at,
                    decode(md5(@TrafficScopeKey || ':' || user_key), 'hex') AS traffic_hash
                FROM release_decision_exposure_events
                WHERE env_id = @EnvId
                  AND flag_key = @FlagKey
                  AND exposed_at >= @StartTime
                  AND exposed_at < @EndTime
                  AND user_key IS NOT NULL
                  AND variation_id IS NOT NULL
            ),
            scoped_exposure AS MATERIALIZED
            (
                SELECT
                    user_key,
                    variation_id,
                    exposed_at
                FROM exposure_source
                WHERE @ApplyTrafficScope = false
                   OR (
                        abs((
                            get_byte(traffic_hash, 0)::bigint +
                            get_byte(traffic_hash, 1)::bigint * 256 +
                            get_byte(traffic_hash, 2)::bigint * 65536 +
                            get_byte(traffic_hash, 3)::bigint * 16777216 -
                            CASE WHEN get_byte(traffic_hash, 3) >= 128 THEN 4294967296 ELSE 0 END
                        )::double precision / -2147483648.0) >= @TrafficBucketStart
                    AND abs((
                            get_byte(traffic_hash, 0)::bigint +
                            get_byte(traffic_hash, 1)::bigint * 256 +
                            get_byte(traffic_hash, 2)::bigint * 65536 +
                            get_byte(traffic_hash, 3)::bigint * 16777216 -
                            CASE WHEN get_byte(traffic_hash, 3) >= 128 THEN 4294967296 ELSE 0 END
                        )::double precision / -2147483648.0) < @TrafficBucketEnd
                   )
            ),
            first_eval AS MATERIALIZED
            (
                SELECT DISTINCT ON (user_key)
                    user_key,
                    variation_id AS variant,
                    exposed_at AS exposure_ts
                FROM scoped_exposure
                ORDER BY user_key, exposed_at
            ),
            metric_source AS MATERIALIZED
            (
                SELECT
                    user_key,
                    occurred_at AS metric_ts,
                    numeric_value
                FROM release_decision_metric_events
                WHERE env_id = @EnvId
                  AND event_name = @MetricEvent
                  AND occurred_at >= @StartTime
                  AND occurred_at < @EndTime
                  AND user_key IS NOT NULL
            ),
            metric_events AS
            (
                SELECT
                    ms.user_key,
                    ms.numeric_value
                FROM metric_source ms
                INNER JOIN first_eval fe
                    ON fe.user_key = ms.user_key
                   AND ms.metric_ts >= fe.exposure_ts
            ),
            user_totals AS MATERIALIZED
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
                request.EnvId,
                request.FlagKey,
                request.MetricEvent,
                StartTime = start,
                EndTime = end,
                trafficScope.ApplyTrafficScope,
                trafficScope.TrafficScopeKey,
                trafficScope.TrafficBucketStart,
                trafficScope.TrafficBucketEnd
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

    private static TrafficScope GetTrafficScope(QueryExperimentStats request)
    {
        var percent = Math.Clamp(request.TrafficPercent ?? 100, 1, 100);
        var offset = Math.Clamp(request.TrafficOffset ?? 0, 0, 99);
        var start = offset / 100d;
        var end = Math.Min(100, offset + percent) / 100d;
        var scopeKey = string.IsNullOrWhiteSpace(request.LayerId) ? request.FlagKey : request.LayerId.Trim();

        return new TrafficScope(offset > 0 || percent < 100, scopeKey, start, end);
    }

    private static DateTime ToUnspecifiedUtcDateTime(DateOnly date)
    {
        return DateTime.SpecifyKind(date.ToDateTime(TimeOnly.MinValue), DateTimeKind.Unspecified);
    }

    private sealed record TrafficScope(
        bool ApplyTrafficScope,
        string TrafficScopeKey,
        double TrafficBucketStart,
        double TrafficBucketEnd);
}

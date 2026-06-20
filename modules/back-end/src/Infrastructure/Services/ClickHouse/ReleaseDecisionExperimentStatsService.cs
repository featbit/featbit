using Application.ExperimentStats;
using Infrastructure.OLAP.ClickHouse;

namespace Infrastructure.Services.ClickHouse;

public class ReleaseDecisionExperimentStatsService(ClickHouseClient clickHouse) : IExperimentStatsService
{
    public async Task<ExperimentStatsVm> QueryAsync(QueryExperimentStats request)
    {
        var start = DateOnly.ParseExact(request.StartDate, "yyyy-MM-dd").ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var end = DateOnly.ParseExact(request.EndDate, "yyyy-MM-dd").AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var contribution = GetUserContributionExpression(request.MetricType, request.MetricAgg);

        var sql = $"""
            WITH first_eval AS
            (
                SELECT
                    user_key,
                    argMin(variation_id, exposed_at) AS variant,
                    min(exposed_at) AS exposure_ts
                FROM release_decision_exposure_events
                WHERE env_id = {ClickHouseSql.Uuid(request.EnvId)}
                  AND flag_key = {ClickHouseSql.String(request.FlagKey)}
                  AND exposed_at >= {ClickHouseSql.DateTime64(start)}
                  AND exposed_at < {ClickHouseSql.DateTime64(end)}
                  AND notEmpty(user_key)
                  AND notEmpty(variation_id)
                GROUP BY user_key
            ),
            metric_source AS
            (
                SELECT
                    user_key,
                    occurred_at AS metric_ts,
                    numeric_value
                FROM release_decision_metric_events
                WHERE env_id = {ClickHouseSql.Uuid(request.EnvId)}
                  AND event_name = {ClickHouseSql.String(request.MetricEvent)}
                  AND occurred_at >= {ClickHouseSql.DateTime64(start)}
                  AND occurred_at < {ClickHouseSql.DateTime64(end)}
                  AND notEmpty(user_key)
            ),
            metric_events AS
            (
                SELECT
                    ms.user_key,
                    ms.numeric_value
                FROM metric_source ms
                INNER JOIN first_eval fe
                    ON fe.user_key = ms.user_key
                WHERE ms.metric_ts >= fe.exposure_ts
            ),
            user_totals AS
            (
                SELECT
                    user_key,
                    count() AS conv_count,
                    sum(numeric_value) AS user_sum,
                    avg(numeric_value) AS user_avg
                FROM metric_events
                GROUP BY user_key
            )
            SELECT
                fe.variant AS Variant,
                toInt64(count()) AS Users,
                toInt64(countIf(ifNull(ut.conv_count, 0) > 0)) AS Conversions,
                toFloat64(sum({contribution})) AS SumValue,
                toFloat64(sum(({contribution}) * ({contribution}))) AS SumSquares
            FROM first_eval fe
            LEFT JOIN user_totals ut ON ut.user_key = fe.user_key
            GROUP BY fe.variant
            ORDER BY fe.variant
            """;

        var rows = await clickHouse.QueryAsync<ExperimentVariantStatsVm>(sql);

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
            "once" => "if(ifNull(ut.conv_count, 0) > 0, 1.0, 0.0)",
            "count" => "toFloat64(ifNull(ut.conv_count, 0))",
            "sum" => "ifNull(ut.user_sum, 0.0)",
            "average" => "ifNull(ut.user_avg, 0.0)",
            _ => throw new ArgumentException($"Unsupported metric aggregation: {metricAgg}", nameof(metricAgg))
        };
    }
}

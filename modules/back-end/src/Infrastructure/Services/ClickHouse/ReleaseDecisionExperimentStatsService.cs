using Application.ExperimentStats;
using Infrastructure.OLAP.ClickHouse;
using System.Text.Json;

namespace Infrastructure.Services.ClickHouse;

public class ReleaseDecisionExperimentStatsService(ClickHouseClient clickHouse) : IExperimentStatsService
{
    public async Task<ExperimentStatsVm> QueryAsync(QueryExperimentStats request)
    {
        if (!string.IsNullOrWhiteSpace(request.AnalysisSamplingPlan))
        {
            return await QueryAnalysisSamplingPlanAsync(request);
        }

        if (!string.IsNullOrWhiteSpace(request.AllocationPlan))
        {
            return await QueryAllocationPlanAsync(request);
        }

        var start = ToUtcDateTime(request.StartTime)
                    ?? DateOnly.ParseExact(request.StartDate, "yyyy-MM-dd").ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var end = ToUtcDateTime(request.EndTime)
                  ?? DateOnly.ParseExact(request.EndDate, "yyyy-MM-dd").AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var contribution = GetUserContributionExpression(request.MetricType, request.MetricAgg);
        var trafficScope = GetTrafficScope(request);
        var selectedVariants = GetSelectedVariants(request);
        var applySelectedVariantFilter = selectedVariants.Length > 0;
        var applyMatchedVariantScope = applySelectedVariantFilter &&
                                       selectedVariants.Length > 1 &&
                                       Math.Clamp(request.TrafficPercent ?? 100, 1, 100) < 100;
        var trafficFilter = trafficScope.ApplyTrafficScope && !applyMatchedVariantScope
            ? $"""
                  AND abs(toFloat64(reinterpretAsInt32(substring(MD5(concat({ClickHouseSql.String(trafficScope.TrafficScopeKey)}, user_key)), 1, 4))) / -2147483648.0) >= {trafficScope.TrafficBucketStart.ToString(System.Globalization.CultureInfo.InvariantCulture)}
                  AND abs(toFloat64(reinterpretAsInt32(substring(MD5(concat({ClickHouseSql.String(trafficScope.TrafficScopeKey)}, user_key)), 1, 4))) / -2147483648.0) < {trafficScope.TrafficBucketEnd.ToString(System.Globalization.CultureInfo.InvariantCulture)}
              """
            : string.Empty;
        var selectedFilter = applySelectedVariantFilter
            ? $"WHERE variant IN ({string.Join(", ", selectedVariants.Select(ClickHouseSql.String))})"
            : string.Empty;
        var matchedFilter = applyMatchedVariantScope
            ? $"""
                  variant_rank <= floor(least(
                    toFloat64(variant_users),
                    greatest(
                      1.0,
                      toFloat64(total_users) * {(Math.Clamp(request.TrafficPercent ?? 100, 1, 100)).ToString(System.Globalization.CultureInfo.InvariantCulture)} / 100.0 / {selectedVariants.Length}
                    )
                  ))
              """
            : "1 = 1";

        var sql = $"""
            WITH first_eval_source AS
            (
                SELECT
                    user_key,
                    argMin(variation_id, exposed_at) AS variant,
                    min(exposed_at) AS exposure_ts,
                    any(abs(toFloat64(reinterpretAsInt32(substring(MD5(concat({ClickHouseSql.String(trafficScope.TrafficScopeKey)}, user_key)), 1, 4))) / -2147483648.0)) AS traffic_hash
                FROM release_decision_exposure_events
                WHERE env_id = {ClickHouseSql.Uuid(request.EnvId)}
                  AND flag_key = {ClickHouseSql.String(request.FlagKey)}
                  AND exposed_at >= {ClickHouseSql.DateTime64(start)}
                  AND exposed_at < {ClickHouseSql.DateTime64(end)}
                  AND notEmpty(user_key)
                  AND notEmpty(variation_id)
                  {trafficFilter}
                GROUP BY user_key
            ),
            selected_eval AS
            (
                SELECT
                    user_key,
                    variant,
                    exposure_ts,
                    traffic_hash
                FROM first_eval_source
                {selectedFilter}
            ),
            ranked_eval AS
            (
                SELECT
                    user_key,
                    variant,
                    exposure_ts,
                    row_number() OVER (PARTITION BY variant ORDER BY traffic_hash, user_key) AS variant_rank,
                    count() OVER (PARTITION BY variant) AS variant_users,
                    count() OVER () AS total_users
                FROM selected_eval
            ),
            first_eval AS
            (
                SELECT
                    user_key,
                    variant,
                    exposure_ts
                FROM ranked_eval
                WHERE {matchedFilter}
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

    private async Task<ExperimentStatsVm> QueryAnalysisSamplingPlanAsync(QueryExperimentStats request)
    {
        var start = ToUtcDateTime(request.StartTime)
                    ?? DateOnly.ParseExact(request.StartDate, "yyyy-MM-dd").ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var end = ToUtcDateTime(request.EndTime)
                  ?? DateOnly.ParseExact(request.EndDate, "yyyy-MM-dd").AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var contribution = GetUserContributionExpression(request.MetricType, request.MetricAgg);
        var plan = ParseSamplingPlan(request.AnalysisSamplingPlan)
            .Where(x => x.Role is "control" or "treatment")
            .ToArray();
        if (plan.Length == 0)
        {
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
                Variants = []
            };
        }

        var assignmentUnitSelector = NormalizeAssignmentUnitSelector(request);
        var layerKey = NormalizeLayerKey(request);
        var layerTrafficPercent = Math.Clamp(request.LayerTrafficPercent ?? 100, 0.000001d, 100d);
        var applyLayer = !string.IsNullOrWhiteSpace(layerKey) && layerTrafficPercent < 100;
        var samplingScopeKey = (request.RunId?.ToString("N") ?? request.FlagKey) + ":";
        var assignmentUnitExpression = AssignmentUnitExpression("user_key", "properties", assignmentUnitSelector);
        var metricAssignmentUnitExpression = AssignmentUnitExpression("user_key", "properties", assignmentUnitSelector);
        var planSql = string.Join("\nUNION ALL\n", plan.Select(item => $"""
            SELECT
                {ClickHouseSql.String(item.Variation)} AS variation,
                {ClickHouseSql.String(item.Role)} AS role,
                {item.IncludeRate.ToString(System.Globalization.CultureInfo.InvariantCulture)} AS include_rate
            """));
        var layerPredicate = applyLayer
            ? $"layer_bucket < {layerTrafficPercent.ToString(System.Globalization.CultureInfo.InvariantCulture)}"
            : "1 = 1";

        var sql = $"""
            WITH plan AS
            (
                {planSql}
            ),
            exposure_base AS
            (
                SELECT
                    {assignmentUnitExpression} AS assignment_unit,
                    user_key,
                    variation_id AS actual_variation_id,
                    exposed_at
                FROM release_decision_exposure_events
                WHERE env_id = {ClickHouseSql.Uuid(request.EnvId)}
                  AND flag_key = {ClickHouseSql.String(request.FlagKey)}
                  AND exposed_at >= {ClickHouseSql.DateTime64(start)}
                  AND exposed_at < {ClickHouseSql.DateTime64(end)}
                  AND notEmpty(user_key)
                  AND notEmpty(variation_id)
            ),
            exposure_source AS
            (
                SELECT
                    eb.assignment_unit,
                    eb.user_key,
                    eb.actual_variation_id,
                    p.role AS analysis_role,
                    eb.exposed_at,
                    if({(applyLayer ? "1" : "0")} = 1,
                        abs(toFloat64(reinterpretAsInt32(substring(MD5(concat({ClickHouseSql.String(layerKey ?? string.Empty)}, eb.assignment_unit)), 1, 4))) / -2147483648.0) * 100.0,
                        NULL) AS layer_bucket,
                    abs(toFloat64(reinterpretAsInt32(substring(MD5(concat({ClickHouseSql.String(samplingScopeKey)}, eb.actual_variation_id, ':', eb.assignment_unit)), 1, 4))) / -2147483648.0) * 100.0 AS sampling_bucket,
                    p.include_rate
                FROM exposure_base eb
                INNER JOIN plan p ON p.variation = eb.actual_variation_id
                WHERE notEmpty(eb.assignment_unit)
            ),
            included_exposure AS
            (
                SELECT *
                FROM exposure_source
                WHERE analysis_role IN ('control', 'treatment')
                  AND {layerPredicate}
                  AND sampling_bucket < include_rate
            ),
            first_eval AS
            (
                SELECT
                    assignment_unit,
                    argMin(user_key, exposed_at) AS user_key,
                    argMin(actual_variation_id, exposed_at) AS variant,
                    min(exposed_at) AS exposure_ts
                FROM included_exposure
                GROUP BY assignment_unit
            ),
            metric_source AS
            (
                SELECT
                    {metricAssignmentUnitExpression} AS assignment_unit,
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
                    ms.assignment_unit,
                    ms.numeric_value
                FROM metric_source ms
                INNER JOIN first_eval fe
                    ON fe.assignment_unit = ms.assignment_unit
                WHERE ms.metric_ts >= fe.exposure_ts
                  AND notEmpty(ms.assignment_unit)
            ),
            user_totals AS
            (
                SELECT
                    assignment_unit,
                    count() AS conv_count,
                    sum(numeric_value) AS user_sum,
                    avg(numeric_value) AS user_avg
                FROM metric_events
                GROUP BY assignment_unit
            )
            SELECT
                fe.variant AS Variant,
                toInt64(count()) AS Users,
                toInt64(countIf(ifNull(ut.conv_count, 0) > 0)) AS Conversions,
                toFloat64(sum({contribution})) AS SumValue,
                toFloat64(sum(({contribution}) * ({contribution}))) AS SumSquares
            FROM first_eval fe
            LEFT JOIN user_totals ut ON ut.assignment_unit = fe.assignment_unit
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

    private async Task<ExperimentStatsVm> QueryAllocationPlanAsync(QueryExperimentStats request)
    {
        var start = ToUtcDateTime(request.StartTime)
                    ?? DateOnly.ParseExact(request.StartDate, "yyyy-MM-dd").ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var end = ToUtcDateTime(request.EndTime)
                  ?? DateOnly.ParseExact(request.EndDate, "yyyy-MM-dd").AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var contribution = GetUserContributionExpression(request.MetricType, request.MetricAgg);
        var layerKey = string.IsNullOrWhiteSpace(request.LayerKey) ? request.FlagKey : request.LayerKey.Trim();
        var allocationKeySelector = string.IsNullOrWhiteSpace(request.AllocationKeySelector)
            ? "user.keyId"
            : request.AllocationKeySelector.Trim();
        var plan = ParseAllocationPlan(request.AllocationPlan);
        if (plan.Length == 0)
        {
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
                Variants = []
            };
        }

        var planSql = string.Join("\nUNION ALL\n", plan.Select(item => $"""
            SELECT
                {ClickHouseSql.String(item.Variant)} AS variant,
                {ClickHouseSql.String(string.IsNullOrWhiteSpace(item.Role) ? "analysis_arm" : item.Role)} AS role,
                {item.Start.ToString(System.Globalization.CultureInfo.InvariantCulture)} AS start_bucket,
                {item.End.ToString(System.Globalization.CultureInfo.InvariantCulture)} AS end_bucket
            """));
        var exposureAllocationKey = AllocationKeyExpression("user_key", "properties", allocationKeySelector);
        var metricAllocationKey = AllocationKeyExpression("user_key", "properties", allocationKeySelector);

        var sql = $"""
            WITH plan AS
            (
                {planSql}
            ),
            exposure_base AS
            (
                SELECT
                    {exposureAllocationKey} AS allocation_key,
                    user_key,
                    variation_id,
                    exposed_at
                FROM release_decision_exposure_events
                WHERE env_id = {ClickHouseSql.Uuid(request.EnvId)}
                  AND flag_key = {ClickHouseSql.String(request.FlagKey)}
                  AND exposed_at >= {ClickHouseSql.DateTime64(start)}
                  AND exposed_at < {ClickHouseSql.DateTime64(end)}
                  AND notEmpty(user_key)
                  AND notEmpty(variation_id)
            ),
            exposure_source AS
            (
                SELECT
                    allocation_key,
                    user_key,
                    variation_id,
                    exposed_at,
                    abs(toFloat64(reinterpretAsInt32(substring(MD5(concat({ClickHouseSql.String(layerKey)}, allocation_key)), 1, 4))) / -2147483648.0) * 100.0 AS bucket
                FROM exposure_base
                WHERE notEmpty(allocation_key)
            ),
            computed_assignments AS
            (
                SELECT
                    es.allocation_key,
                    es.user_key,
                    p.variant AS expected_variation_id,
                    es.variation_id AS actual_variation_id,
                    if(p.role != 'analysis_arm', p.role, if(es.variation_id = p.variant, 'analysis_arm', 'mismatch')) AS role,
                    es.exposed_at AS exposed_at
                FROM exposure_source es
                CROSS JOIN plan p
                WHERE es.bucket >= {(Math.Clamp(request.SliceStart ?? 0, 0, 100)).ToString(System.Globalization.CultureInfo.InvariantCulture)}
                  AND es.bucket < {(Math.Clamp(request.SliceEnd ?? 100, 0, 100)).ToString(System.Globalization.CultureInfo.InvariantCulture)}
                  AND es.bucket >= p.start_bucket
                  AND es.bucket < p.end_bucket
            ),
            first_assignment AS
            (
                SELECT
                    allocation_key,
                    user_key,
                    expected_variation_id,
                    actual_variation_id,
                    role,
                    exposed_at AS first_exposed_at
                FROM
                (
                    SELECT
                        *,
                        row_number() OVER (PARTITION BY allocation_key ORDER BY exposed_at) AS rn
                    FROM computed_assignments
                    WHERE role != 'mismatch'
                )
                WHERE rn = 1
            ),
            first_eval AS
            (
                SELECT
                    allocation_key,
                    expected_variation_id AS variant,
                    first_exposed_at AS exposure_ts
                FROM first_assignment
                WHERE role = 'analysis_arm'
            ),
            metric_source AS
            (
                SELECT
                    {metricAllocationKey} AS allocation_key,
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
                    ms.allocation_key,
                    ms.numeric_value
                FROM metric_source ms
                INNER JOIN first_eval fe
                    ON fe.allocation_key = ms.allocation_key
                WHERE ms.metric_ts >= fe.exposure_ts
            ),
            user_totals AS
            (
                SELECT
                    allocation_key,
                    count() AS conv_count,
                    sum(numeric_value) AS user_sum,
                    avg(numeric_value) AS user_avg
                FROM metric_events
                GROUP BY allocation_key
            )
            SELECT
                fe.variant AS Variant,
                toInt64(count()) AS Users,
                toInt64(countIf(ifNull(ut.conv_count, 0) > 0)) AS Conversions,
                toFloat64(sum({contribution})) AS SumValue,
                toFloat64(sum(({contribution}) * ({contribution}))) AS SumSquares
            FROM first_eval fe
            LEFT JOIN user_totals ut ON ut.allocation_key = fe.allocation_key
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

    private static TrafficScope GetTrafficScope(QueryExperimentStats request)
    {
        var percent = Math.Clamp(request.TrafficPercent ?? 100, 1, 100);
        var offset = Math.Clamp(request.TrafficOffset ?? 0, 0, 99);
        var start = offset / 100d;
        var end = Math.Min(100, offset + percent) / 100d;
        var scopeKey = string.IsNullOrWhiteSpace(request.LayerId) ? request.FlagKey : request.LayerId.Trim();

        return new TrafficScope(offset > 0 || percent < 100, scopeKey, start, end);
    }

    private sealed record TrafficScope(
        bool ApplyTrafficScope,
        string TrafficScopeKey,
        double TrafficBucketStart,
        double TrafficBucketEnd);

    private static string[] GetSelectedVariants(QueryExperimentStats request)
    {
        return new[] { request.ControlVariant }
            .Concat((request.TreatmentVariants ?? string.Empty)
                .Split('|', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Distinct(StringComparer.Ordinal)
            .ToArray();
    }

    private static string AllocationKeyExpression(string userKeyColumn, string propertiesColumn, string selector)
    {
        return string.IsNullOrWhiteSpace(selector) ||
               selector is "user.keyId" or "user.key" or "keyId"
            ? userKeyColumn
            : $"ifNull(nullIf(JSONExtractString({propertiesColumn}, {ClickHouseSql.String(selector)}), ''), {userKeyColumn})";
    }

    private static string AssignmentUnitExpression(string userKeyColumn, string propertiesColumn, string selector)
    {
        return string.IsNullOrWhiteSpace(selector) ||
               selector is "user.keyId" or "user.key" or "keyId"
            ? userKeyColumn
            : $"nullIf(JSONExtractString({propertiesColumn}, {ClickHouseSql.String(selector)}), '')";
    }

    private static string NormalizeAssignmentUnitSelector(QueryExperimentStats request)
    {
        return string.IsNullOrWhiteSpace(request.AssignmentUnitSelector)
            ? string.IsNullOrWhiteSpace(request.AllocationKeySelector)
                ? "user.keyId"
                : request.AllocationKeySelector.Trim()
            : request.AssignmentUnitSelector.Trim();
    }

    private static string NormalizeLayerKey(QueryExperimentStats request)
    {
        return string.IsNullOrWhiteSpace(request.LayerKey)
            ? string.IsNullOrWhiteSpace(request.LayerId)
                ? null
                : request.LayerId.Trim()
            : request.LayerKey.Trim();
    }

    private static AllocationPlanEntry[] ParseAllocationPlan(string allocationPlan)
    {
        return JsonSerializer.Deserialize<AllocationPlanEntry[]>(allocationPlan, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        }) ?? [];
    }

    private static SamplingPlanEntry[] ParseSamplingPlan(string samplingPlan)
    {
        return JsonSerializer.Deserialize<SamplingPlanEntry[]>(samplingPlan, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        })?
        .Where(x => !string.IsNullOrWhiteSpace(x.Variation))
        .Select(x => x with
        {
            Role = NormalizeRole(x.Role),
            IncludeRate = Math.Clamp(x.IncludeRate, 0, 100)
        })
        .ToArray() ?? [];
    }

    private static string NormalizeRole(string role)
    {
        var normalized = (role ?? string.Empty).Trim().ToLowerInvariant();
        return normalized is "control" or "treatment" or "holdout" or "exclude"
            ? normalized
            : "treatment";
    }

    private static DateTime? ToUtcDateTime(DateTime? value)
    {
        return value?.ToUniversalTime();
    }

    private sealed record AllocationPlanEntry(
        string Variant,
        string Role,
        double Start,
        double End);

    private sealed record SamplingPlanEntry(
        string Variation,
        string Role,
        double IncludeRate,
        string Label);
}

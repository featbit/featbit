using Application.ExperimentStats;
using Dapper;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Infrastructure.Services.EntityFrameworkCore;

public class ReleaseDecisionExperimentStatsService(AppDbContext dbContext) : IExperimentStatsService
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

        var start = ToUnspecifiedUtcDateTime(request.StartTime)
                    ?? ToUnspecifiedUtcDateTime(DateOnly.ParseExact(request.StartDate, "yyyy-MM-dd"));
        var end = ToUnspecifiedUtcDateTime(request.EndTime)
                  ?? ToUnspecifiedUtcDateTime(DateOnly.ParseExact(request.EndDate, "yyyy-MM-dd").AddDays(1));
        var contribution = GetUserContributionExpression(request.MetricType, request.MetricAgg);
        var trafficScope = GetTrafficScope(request);
        var selectedVariants = GetSelectedVariants(request);
        var applySelectedVariantFilter = selectedVariants.Length > 0;
        var applyMatchedVariantScope = applySelectedVariantFilter &&
                                       selectedVariants.Length > 1 &&
                                       Math.Clamp(request.TrafficPercent ?? 100, 1, 100) < 100;
        var applyTrafficScope = trafficScope.ApplyTrafficScope && !applyMatchedVariantScope;

        var sql = $"""
            WITH exposure_source AS MATERIALIZED
            (
                SELECT
                    user_key,
                    variation_id,
                    exposed_at,
                    decode(md5(@TrafficScopeKey || user_key), 'hex') AS traffic_hash
                FROM release_decision_exposure_events
                WHERE env_id = @EnvId
                  AND flag_key = @FlagKey
                  AND exposed_at >= @StartTime
                  AND exposed_at < @EndTime
                  AND user_key IS NOT NULL
                  AND variation_id IS NOT NULL
            ),
            traffic_scoped_exposure AS MATERIALIZED
            (
                SELECT
                    user_key,
                    variation_id,
                    exposed_at,
                    traffic_hash
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
            first_eval_source AS MATERIALIZED
            (
                SELECT DISTINCT ON (user_key)
                    user_key,
                    variation_id AS variant,
                    exposed_at AS exposure_ts,
                    traffic_hash
                FROM traffic_scoped_exposure
                ORDER BY user_key, exposed_at
            ),
            selected_eval AS MATERIALIZED
            (
                SELECT
                    user_key,
                    variant,
                    exposure_ts,
                    traffic_hash
                FROM first_eval_source
                WHERE @ApplySelectedVariantFilter = false
                   OR variant = ANY(@SelectedVariants)
            ),
            ranked_eval AS MATERIALIZED
            (
                SELECT
                    user_key,
                    variant,
                    exposure_ts,
                    row_number() OVER (PARTITION BY variant ORDER BY traffic_hash, user_key) AS variant_rank,
                    count(*) OVER (PARTITION BY variant) AS variant_users,
                    count(*) OVER () AS total_users
                FROM selected_eval
            ),
            first_eval AS MATERIALIZED
            (
                SELECT
                    user_key,
                    variant,
                    exposure_ts
                FROM ranked_eval
                WHERE @ApplyMatchedVariantScope = false
                   OR variant_rank <= floor(least(
                        variant_users::double precision,
                        greatest(
                            1.0,
                            total_users::double precision * @TrafficPercentValue / 100.0 / @SelectedVariantCount
                        )
                   ))
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
                ApplyTrafficScope = applyTrafficScope,
                ApplySelectedVariantFilter = applySelectedVariantFilter,
                ApplyMatchedVariantScope = applyMatchedVariantScope,
                SelectedVariants = selectedVariants,
                SelectedVariantCount = Math.Max(selectedVariants.Length, 1),
                TrafficPercentValue = Math.Clamp(request.TrafficPercent ?? 100, 1, 100),
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

    private async Task<ExperimentStatsVm> QueryAnalysisSamplingPlanAsync(QueryExperimentStats request)
    {
        var start = ToUnspecifiedUtcDateTime(request.StartTime)
                    ?? ToUnspecifiedUtcDateTime(DateOnly.ParseExact(request.StartDate, "yyyy-MM-dd"));
        var end = ToUnspecifiedUtcDateTime(request.EndTime)
                  ?? ToUnspecifiedUtcDateTime(DateOnly.ParseExact(request.EndDate, "yyyy-MM-dd").AddDays(1));
        var contribution = GetUserContributionExpression(request.MetricType, request.MetricAgg);
        var assignmentUnitSelector = NormalizeAssignmentUnitSelector(request);
        var layerKey = NormalizeLayerKey(request);
        var applyLayer = !string.IsNullOrWhiteSpace(layerKey) && Math.Clamp(request.LayerTrafficPercent ?? 100, 0d, 100d) < 100;
        var layerTrafficPercent = Math.Clamp(request.LayerTrafficPercent ?? 100, 0d, 100d);
        var samplingScopeKey = (request.RunId?.ToString("N") ?? request.FlagKey) + ":";

        var sql = $"""
            WITH plan AS MATERIALIZED
            (
                SELECT
                    variation,
                    CASE
                        WHEN lower(coalesce(role, '')) IN ('control', 'treatment') THEN lower(role)
                        WHEN lower(coalesce(role, '')) IN ('holdout', 'exclude') THEN lower(role)
                        ELSE 'treatment'
                    END AS role,
                    greatest(0.0, least(100.0, coalesce("includeRate", 100.0))) AS include_rate
                FROM jsonb_to_recordset(@AnalysisSamplingPlan::jsonb)
                    AS p(variation text, role text, "includeRate" double precision, label text)
                WHERE variation IS NOT NULL
            ),
            exposure_base AS MATERIALIZED
            (
                SELECT
                    CASE
                        WHEN @AssignmentUnitSelector IN ('user.keyId', 'user.key', 'keyId', '')
                            THEN user_key
                        ELSE properties ->> @AssignmentUnitSelector
                    END AS assignment_unit,
                    user_key,
                    variation_id AS actual_variation_id,
                    exposed_at
                FROM release_decision_exposure_events
                WHERE env_id = @EnvId
                  AND flag_key = @FlagKey
                  AND exposed_at >= @StartTime
                  AND exposed_at < @EndTime
                  AND user_key IS NOT NULL
                  AND variation_id IS NOT NULL
            ),
            exposure_source AS MATERIALIZED
            (
                SELECT
                    eb.assignment_unit,
                    eb.user_key,
                    eb.actual_variation_id,
                    p.role AS analysis_role,
                    eb.exposed_at,
                    CASE WHEN @ApplyLayer THEN abs((
                        get_byte(decode(md5(@LayerKey || eb.assignment_unit), 'hex'), 0)::bigint +
                        get_byte(decode(md5(@LayerKey || eb.assignment_unit), 'hex'), 1)::bigint * 256 +
                        get_byte(decode(md5(@LayerKey || eb.assignment_unit), 'hex'), 2)::bigint * 65536 +
                        get_byte(decode(md5(@LayerKey || eb.assignment_unit), 'hex'), 3)::bigint * 16777216 -
                        CASE WHEN get_byte(decode(md5(@LayerKey || eb.assignment_unit), 'hex'), 3) >= 128 THEN 4294967296 ELSE 0 END
                    )::double precision / -2147483648.0) * 100.0 ELSE NULL END AS layer_bucket,
                    abs((
                        get_byte(decode(md5(@SamplingScopeKey || eb.actual_variation_id || ':' || eb.assignment_unit), 'hex'), 0)::bigint +
                        get_byte(decode(md5(@SamplingScopeKey || eb.actual_variation_id || ':' || eb.assignment_unit), 'hex'), 1)::bigint * 256 +
                        get_byte(decode(md5(@SamplingScopeKey || eb.actual_variation_id || ':' || eb.assignment_unit), 'hex'), 2)::bigint * 65536 +
                        get_byte(decode(md5(@SamplingScopeKey || eb.actual_variation_id || ':' || eb.assignment_unit), 'hex'), 3)::bigint * 16777216 -
                        CASE WHEN get_byte(decode(md5(@SamplingScopeKey || eb.actual_variation_id || ':' || eb.assignment_unit), 'hex'), 3) >= 128 THEN 4294967296 ELSE 0 END
                    )::double precision / -2147483648.0) * 100.0 AS sampling_bucket,
                    p.include_rate
                FROM exposure_base eb
                INNER JOIN plan p ON p.variation = eb.actual_variation_id
                WHERE eb.assignment_unit IS NOT NULL
                  AND eb.assignment_unit <> ''
            ),
            included_exposure AS MATERIALIZED
            (
                SELECT *
                FROM exposure_source
                WHERE analysis_role IN ('control', 'treatment')
                  AND (@ApplyLayer = false OR layer_bucket < @LayerTrafficPercent)
                  AND sampling_bucket < include_rate
            ),
            first_eval AS MATERIALIZED
            (
                SELECT DISTINCT ON (assignment_unit)
                    assignment_unit,
                    user_key,
                    actual_variation_id AS variant,
                    analysis_role,
                    layer_bucket,
                    sampling_bucket,
                    exposed_at AS exposure_ts
                FROM included_exposure
                ORDER BY assignment_unit, exposed_at
            ),
            delete_existing_assignments AS
            (
                DELETE FROM release_decision_run_assignments
                WHERE @RunId IS NOT NULL
                  AND run_id = @RunId
                RETURNING 1
            ),
            upsert_assignments AS
            (
                INSERT INTO release_decision_run_assignments
                    (id, run_id, env_id, flag_key, allocation_key, assignment_unit, user_key,
                     expected_variation_id, actual_variation_id, role, analysis_role, bucket,
                     layer_bucket, sampling_bucket, included_by_sampling, assigned_at,
                     first_exposed_at, created_at, updated_at)
                SELECT
                    gen_random_uuid(),
                    @RunId,
                    @EnvId,
                    @FlagKey,
                    assignment_unit,
                    assignment_unit,
                    user_key,
                    variant,
                    variant,
                    analysis_role,
                    analysis_role,
                    coalesce(sampling_bucket, 0),
                    layer_bucket,
                    sampling_bucket,
                    true,
                    @Now,
                    exposure_ts,
                    @Now,
                    @Now
                FROM first_eval
                CROSS JOIN (SELECT count(*) FROM delete_existing_assignments) deleted
                WHERE @RunId IS NOT NULL
                ON CONFLICT (run_id, assignment_unit)
                DO UPDATE SET
                    allocation_key = EXCLUDED.allocation_key,
                    user_key = EXCLUDED.user_key,
                    expected_variation_id = EXCLUDED.expected_variation_id,
                    actual_variation_id = EXCLUDED.actual_variation_id,
                    role = EXCLUDED.role,
                    analysis_role = EXCLUDED.analysis_role,
                    bucket = EXCLUDED.bucket,
                    layer_bucket = EXCLUDED.layer_bucket,
                    sampling_bucket = EXCLUDED.sampling_bucket,
                    included_by_sampling = EXCLUDED.included_by_sampling,
                    first_exposed_at = EXCLUDED.first_exposed_at,
                    updated_at = EXCLUDED.updated_at
                RETURNING assignment_unit
            ),
            metric_source AS MATERIALIZED
            (
                SELECT
                    CASE
                        WHEN @AssignmentUnitSelector IN ('user.keyId', 'user.key', 'keyId', '')
                            THEN user_key
                        ELSE properties ->> @AssignmentUnitSelector
                    END AS assignment_unit,
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
                    ms.assignment_unit,
                    ms.numeric_value
                FROM metric_source ms
                INNER JOIN first_eval fe
                    ON fe.assignment_unit = ms.assignment_unit
                   AND ms.metric_ts >= fe.exposure_ts
                WHERE ms.assignment_unit IS NOT NULL
                  AND ms.assignment_unit <> ''
            ),
            user_totals AS MATERIALIZED
            (
                SELECT
                    assignment_unit,
                    count(*) AS conv_count,
                    sum(numeric_value) AS user_sum,
                    avg(numeric_value) AS user_avg
                FROM metric_events
                GROUP BY assignment_unit
            )
            SELECT
                fe.variant AS Variant,
                count(*)::bigint AS Users,
                count(*) FILTER (WHERE coalesce(ut.conv_count, 0) > 0)::bigint AS Conversions,
                sum({contribution})::double precision AS SumValue,
                sum(({contribution}) * ({contribution}))::double precision AS SumSquares
            FROM first_eval fe
            LEFT JOIN user_totals ut ON ut.assignment_unit = fe.assignment_unit
            GROUP BY fe.variant
            ORDER BY fe.variant
            """;

        var rows = (await dbContext.Database.GetDbConnection().QueryAsync<ExperimentVariantStatsVm>(
            sql,
            new
            {
                request.RunId,
                request.EnvId,
                request.FlagKey,
                request.MetricEvent,
                StartTime = start,
                EndTime = end,
                AssignmentUnitSelector = assignmentUnitSelector,
                ApplyLayer = applyLayer,
                LayerKey = layerKey ?? string.Empty,
                LayerTrafficPercent = layerTrafficPercent,
                SamplingScopeKey = samplingScopeKey,
                request.AnalysisSamplingPlan,
                Now = DateTime.UtcNow
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

    private async Task<ExperimentStatsVm> QueryAllocationPlanAsync(QueryExperimentStats request)
    {
        var start = ToUnspecifiedUtcDateTime(request.StartTime)
                    ?? ToUnspecifiedUtcDateTime(DateOnly.ParseExact(request.StartDate, "yyyy-MM-dd"));
        var end = ToUnspecifiedUtcDateTime(request.EndTime)
                  ?? ToUnspecifiedUtcDateTime(DateOnly.ParseExact(request.EndDate, "yyyy-MM-dd").AddDays(1));
        var contribution = GetUserContributionExpression(request.MetricType, request.MetricAgg);
        var layerKey = string.IsNullOrWhiteSpace(request.LayerKey)
            ? request.FlagKey
            : request.LayerKey.Trim();
        var allocationKeySelector = string.IsNullOrWhiteSpace(request.AllocationKeySelector)
            ? "user.keyId"
            : request.AllocationKeySelector.Trim();

        var sql = $"""
            WITH plan AS MATERIALIZED
            (
                SELECT
                    variant,
                    coalesce(nullif(role, ''), 'analysis_arm') AS role,
                    "start" AS start_bucket,
                    "end" AS end_bucket
                FROM jsonb_to_recordset(@AllocationPlan::jsonb)
                    AS p(variant text, role text, "start" double precision, "end" double precision)
                WHERE variant IS NOT NULL
                  AND "end" > "start"
            ),
            exposure_base AS MATERIALIZED
            (
                SELECT
                    CASE
                        WHEN @AllocationKeySelector IN ('user.keyId', 'user.key', 'keyId', '')
                            THEN user_key
                        ELSE coalesce(properties ->> @AllocationKeySelector, user_key)
                    END AS allocation_key,
                    user_key,
                    variation_id,
                    exposed_at
                FROM release_decision_exposure_events
                WHERE env_id = @EnvId
                  AND flag_key = @FlagKey
                  AND exposed_at >= @StartTime
                  AND exposed_at < @EndTime
                  AND user_key IS NOT NULL
                  AND variation_id IS NOT NULL
            ),
            exposure_source AS MATERIALIZED
            (
                SELECT
                    allocation_key,
                    user_key,
                    variation_id,
                    exposed_at,
                    abs((
                        get_byte(decode(md5(@LayerKey || allocation_key), 'hex'), 0)::bigint +
                        get_byte(decode(md5(@LayerKey || allocation_key), 'hex'), 1)::bigint * 256 +
                        get_byte(decode(md5(@LayerKey || allocation_key), 'hex'), 2)::bigint * 65536 +
                        get_byte(decode(md5(@LayerKey || allocation_key), 'hex'), 3)::bigint * 16777216 -
                        CASE WHEN get_byte(decode(md5(@LayerKey || allocation_key), 'hex'), 3) >= 128 THEN 4294967296 ELSE 0 END
                    )::double precision / -2147483648.0) * 100.0 AS bucket
                FROM exposure_base
                WHERE allocation_key IS NOT NULL
            ),
            exposure_with_plan AS MATERIALIZED
            (
                SELECT
                    es.allocation_key,
                    es.user_key,
                    p.variant AS expected_variation_id,
                    es.variation_id AS actual_variation_id,
                    CASE
                        WHEN p.role <> 'analysis_arm' THEN p.role
                        WHEN es.variation_id = p.variant THEN 'analysis_arm'
                        ELSE 'mismatch'
                    END AS role,
                    es.bucket,
                    es.exposed_at
                FROM exposure_source es
                INNER JOIN plan p
                    ON es.bucket >= p.start_bucket
                   AND es.bucket < p.end_bucket
                WHERE es.bucket >= @SliceStart
                  AND es.bucket < @SliceEnd
            ),
            computed_assignments AS MATERIALIZED
            (
                SELECT DISTINCT ON (allocation_key)
                    allocation_key,
                    user_key,
                    expected_variation_id,
                    actual_variation_id,
                    role,
                    bucket,
                    exposed_at AS first_exposed_at
                FROM exposure_with_plan
                WHERE role <> 'mismatch'
                ORDER BY allocation_key, exposed_at
            ),
            delete_existing_assignments AS
            (
                DELETE FROM release_decision_run_assignments
                WHERE @RunId IS NOT NULL
                  AND run_id = @RunId
                RETURNING 1
            ),
            upsert_assignments AS
            (
                INSERT INTO release_decision_run_assignments
                    (id, run_id, env_id, flag_key, allocation_key, assignment_unit, user_key, expected_variation_id,
                     actual_variation_id, role, analysis_role, bucket, sampling_bucket, included_by_sampling,
                     assigned_at, first_exposed_at, created_at, updated_at)
                SELECT
                    gen_random_uuid(),
                    @RunId,
                    @EnvId,
                    @FlagKey,
                    allocation_key,
                    allocation_key,
                    user_key,
                    expected_variation_id,
                    actual_variation_id,
                    role,
                    role,
                    bucket,
                    bucket,
                    true,
                    @Now,
                    first_exposed_at,
                    @Now,
                    @Now
                FROM computed_assignments
                CROSS JOIN (SELECT count(*) FROM delete_existing_assignments) deleted
                WHERE @RunId IS NOT NULL
                ON CONFLICT (run_id, allocation_key)
                DO UPDATE SET
                    user_key = EXCLUDED.user_key,
                    expected_variation_id = EXCLUDED.expected_variation_id,
                    actual_variation_id = EXCLUDED.actual_variation_id,
                    role = EXCLUDED.role,
                    bucket = EXCLUDED.bucket,
                    first_exposed_at = EXCLUDED.first_exposed_at,
                    updated_at = EXCLUDED.updated_at
                RETURNING allocation_key
            ),
            first_eval AS MATERIALIZED
            (
                SELECT
                    allocation_key,
                    expected_variation_id AS variant,
                    first_exposed_at AS exposure_ts
                FROM computed_assignments
                WHERE role = 'analysis_arm'
            ),
            metric_source AS MATERIALIZED
            (
                SELECT
                    CASE
                        WHEN @AllocationKeySelector IN ('user.keyId', 'user.key', 'keyId', '')
                            THEN user_key
                        ELSE coalesce(properties ->> @AllocationKeySelector, user_key)
                    END AS allocation_key,
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
                    ms.allocation_key,
                    ms.numeric_value
                FROM metric_source ms
                INNER JOIN first_eval fe
                    ON fe.allocation_key = ms.allocation_key
                   AND ms.metric_ts >= fe.exposure_ts
            ),
            user_totals AS MATERIALIZED
            (
                SELECT
                    allocation_key,
                    count(*) AS conv_count,
                    sum(numeric_value) AS user_sum,
                    avg(numeric_value) AS user_avg
                FROM metric_events
                GROUP BY allocation_key
            )
            SELECT
                fe.variant AS Variant,
                count(*)::bigint AS Users,
                count(*) FILTER (WHERE coalesce(ut.conv_count, 0) > 0)::bigint AS Conversions,
                sum({contribution})::double precision AS SumValue,
                sum(({contribution}) * ({contribution}))::double precision AS SumSquares
            FROM first_eval fe
            LEFT JOIN user_totals ut ON ut.allocation_key = fe.allocation_key
            GROUP BY fe.variant
            ORDER BY fe.variant
            """;

        var rows = (await dbContext.Database.GetDbConnection().QueryAsync<ExperimentVariantStatsVm>(
            sql,
            new
            {
                request.RunId,
                request.EnvId,
                request.FlagKey,
                request.MetricEvent,
                StartTime = start,
                EndTime = end,
                LayerKey = layerKey,
                AllocationKeySelector = allocationKeySelector,
                SliceStart = Math.Clamp(request.SliceStart ?? 0, 0, 100),
                SliceEnd = Math.Clamp(request.SliceEnd ?? 100, 0, 100),
                request.AllocationPlan,
                Now = DateTime.UtcNow
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

    private static string[] GetSelectedVariants(QueryExperimentStats request)
    {
        return new[] { request.ControlVariant }
            .Concat((request.TreatmentVariants ?? string.Empty)
                .Split('|', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Distinct(StringComparer.Ordinal)
            .ToArray();
    }

    private static string NormalizeAssignmentUnitSelector(QueryExperimentStats request)
    {
        return string.IsNullOrWhiteSpace(request.AssignmentUnitSelector)
            ? string.IsNullOrWhiteSpace(request.AllocationKeySelector)
                ? "user.keyId"
                : request.AllocationKeySelector.Trim()
            : request.AssignmentUnitSelector.Trim();
    }

    private static string? NormalizeLayerKey(QueryExperimentStats request)
    {
        return string.IsNullOrWhiteSpace(request.LayerKey)
            ? string.IsNullOrWhiteSpace(request.LayerId)
                ? null
                : request.LayerId.Trim()
            : request.LayerKey.Trim();
    }

    private static DateTime ToUnspecifiedUtcDateTime(DateOnly date)
    {
        return DateTime.SpecifyKind(date.ToDateTime(TimeOnly.MinValue), DateTimeKind.Unspecified);
    }

    private static DateTime? ToUnspecifiedUtcDateTime(DateTime? value)
    {
        return value.HasValue
            ? DateTime.SpecifyKind(value.Value.ToUniversalTime(), DateTimeKind.Unspecified)
            : null;
    }

    private sealed record TrafficScope(
        bool ApplyTrafficScope,
        string TrafficScopeKey,
        double TrafficBucketStart,
        double TrafficBucketEnd);
}

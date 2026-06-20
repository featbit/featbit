using Domain.FeatureFlags;
using Infrastructure.OLAP.ClickHouse;

namespace Infrastructure.Services.ClickHouse;

public class ReleaseDecisionFeatureFlagEndUserStatsService(ClickHouseClient clickHouse) : IFeatureFlagEndUserStatsService
{
    public async Task<FeatureFlagEndUserStats> GetFeatureFlagEndUserStatsAsync(FeatureFlagEndUserParam param)
    {
        var from = DateTimeOffset.FromUnixTimeMilliseconds(param.StartTime);
        var to = DateTimeOffset.FromUnixTimeMilliseconds(param.EndTime);
        var variationId = string.IsNullOrWhiteSpace(param.VariationId) ? null : param.VariationId.Trim();
        var query = string.IsNullOrWhiteSpace(param.Query) ? null : param.Query.Trim();
        var pageSize = Math.Max(param.PageSize, 1);
        var offset = Math.Max(param.PageIndex, 0) * pageSize;

        var variationClause = variationId == null
            ? string.Empty
            : $"AND variation_id = {ClickHouseSql.String(variationId)}";
        var queryClause = query == null
            ? string.Empty
            : $"""
               AND (
                   positionCaseInsensitive(user_key, {ClickHouseSql.String(query)}) > 0
                   OR positionCaseInsensitive(user_name, {ClickHouseSql.String(query)}) > 0
               )
               """;

        var sql = $"""
            WITH evaluations AS
            (
                SELECT
                    user_key AS KeyId,
                    variation_id AS VariationId,
                    argMax(if(empty(user_name), user_key, user_name), exposed_at) AS Name,
                    max(exposed_at) AS LastEvaluatedAt
                FROM release_decision_exposure_events
                WHERE env_id = {ClickHouseSql.Uuid(param.EnvId)}
                  AND flag_key = {ClickHouseSql.String(param.FeatureFlagKey)}
                  AND exposed_at >= {ClickHouseSql.DateTime64(from)}
                  AND exposed_at <= {ClickHouseSql.DateTime64(to)}
                  AND notEmpty(user_key)
                  AND notEmpty(variation_id)
                  {variationClause}
                GROUP BY KeyId, VariationId
            ),
            filtered AS
            (
                SELECT VariationId, KeyId, Name, LastEvaluatedAt
                FROM evaluations
                WHERE 1 = 1
                {queryClause}
            )
            SELECT
                toInt32(count() OVER()) AS TotalCount,
                VariationId,
                KeyId,
                Name,
                toUnixTimestamp64Milli(LastEvaluatedAt) AS LastEvaluatedAtMs
            FROM filtered
            ORDER BY LastEvaluatedAt DESC, KeyId
            LIMIT {ClickHouseSql.Int(pageSize)}
            OFFSET {ClickHouseSql.Int(offset)}
            """;

        var rows = await clickHouse.QueryAsync<FeatureFlagEndUserRow>(sql);

        return new FeatureFlagEndUserStats
        {
            TotalCount = rows.FirstOrDefault()?.TotalCount ?? 0,
            Items = rows.Select(x => new FeatureFlagEndUser
            {
                VariationId = x.VariationId,
                KeyId = x.KeyId,
                Name = string.IsNullOrWhiteSpace(x.Name) ? x.KeyId : x.Name,
                LastEvaluatedAt = DateTimeOffset.FromUnixTimeMilliseconds(x.LastEvaluatedAtMs).UtcDateTime.ToString("O")
            }).ToArray()
        };
    }

    private sealed class FeatureFlagEndUserRow
    {
        public int TotalCount { get; init; }
        public string VariationId { get; init; } = string.Empty;
        public string KeyId { get; init; } = string.Empty;
        public string Name { get; init; } = string.Empty;
        public long LastEvaluatedAtMs { get; init; }
    }
}

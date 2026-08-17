using Application.EndUsers;
using Infrastructure.OLAP.ClickHouse;

namespace Infrastructure.Services.ClickHouse;

public class EndUserStatsService(ClickHouseClient clickHouse) : IEndUserStatsService
{
    public async Task<EndUserStats> GetEndUserStatsAsync(Guid envId, EndUserStatsFilter filter)
    {
        var from = DateTimeOffset.FromUnixTimeMilliseconds(filter.From);
        var to = DateTimeOffset.FromUnixTimeMilliseconds(filter.To);
        var variationId = string.IsNullOrWhiteSpace(filter.VariationId) ? null : filter.VariationId.Trim();
        var query = string.IsNullOrWhiteSpace(filter.Query) ? null : filter.Query.Trim();
        var pageSize = Math.Max(filter.PageSize, 1);
        var offset = Math.Max(filter.PageIndex, 0) * pageSize;

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
                FROM experiment_exposure_events
                WHERE env_id = {ClickHouseSql.Uuid(envId)}
                  AND flag_key = {ClickHouseSql.String(filter.FeatureFlagKey)}
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

        return new EndUserStats
        {
            TotalCount = rows.FirstOrDefault()?.TotalCount ?? 0,
            Items = rows.Select(x => new EndUserStatsItem
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

using Application.EndUsers;
using Dapper;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Services.EntityFrameworkCore;

public class EndUserStatsService(AppDbContext dbContext) : IEndUserStatsService
{
    public async Task<EndUserStats> GetEndUserStatsAsync(Guid envId, EndUserStatsFilter filter)
    {
        var from = DateTimeOffset.FromUnixTimeMilliseconds(filter.From);
        var to = DateTimeOffset.FromUnixTimeMilliseconds(filter.To);
        var query = string.IsNullOrWhiteSpace(filter.Query) ? null : $"%{filter.Query.Trim()}%";
        var variationId = string.IsNullOrWhiteSpace(filter.VariationId) ? null : filter.VariationId.Trim();
        var pageSize = Math.Max(filter.PageSize, 1);
        var offset = Math.Max(filter.PageIndex, 0) * pageSize;

        var sql = """
            WITH evaluations AS
            (
                SELECT
                    user_key AS KeyId,
                    variation_id AS VariationId,
                    max(exposed_at) AS LastEvaluatedAt
                FROM experiment_exposure_events
                WHERE env_id = @EnvId
                  AND flag_key = @FeatureFlagKey
                  AND exposed_at >= @From
                  AND exposed_at <= @To
                  AND user_key IS NOT NULL
                  AND variation_id IS NOT NULL
                  AND (@VariationId IS NULL OR variation_id = @VariationId)
                GROUP BY KeyId, VariationId
            ),
            filtered AS
            (
                SELECT
                    e.VariationId,
                    e.KeyId,
                    coalesce(u.name, e.KeyId) AS Name,
                    e.LastEvaluatedAt
                FROM evaluations e
                LEFT JOIN end_users u ON u.env_id = @EnvId AND u.key_id = e.KeyId
                WHERE @Query IS NULL OR e.KeyId ILIKE @Query OR u.name ILIKE @Query
            )
            SELECT
                count(*) OVER()::int AS TotalCount,
                VariationId,
                KeyId,
                Name,
                LastEvaluatedAt
            FROM filtered
            ORDER BY LastEvaluatedAt DESC, KeyId
            OFFSET @Offset
            LIMIT @PageSize
            """;

        var connection = dbContext.Database.GetDbConnection();
        var rows = (await connection.QueryAsync<FeatureFlagEndUserRow>(
            sql,
            new
            {
                EnvId = envId,
                filter.FeatureFlagKey,
                VariationId = variationId,
                Query = query,
                From = from,
                To = to,
                Offset = offset,
                PageSize = pageSize
            })).AsList();

        return new EndUserStats
        {
            TotalCount = rows.FirstOrDefault()?.TotalCount ?? 0,
            Items = rows.Select(x => new EndUserStatsItem
            {
                VariationId = x.VariationId,
                KeyId = x.KeyId,
                Name = x.Name,
                LastEvaluatedAt = DateTime.SpecifyKind(x.LastEvaluatedAt, DateTimeKind.Utc).ToString("O")
            }).ToArray()
        };
    }

    private sealed class FeatureFlagEndUserRow
    {
        public int TotalCount { get; init; }
        public string VariationId { get; init; } = string.Empty;
        public string KeyId { get; init; } = string.Empty;
        public string Name { get; init; } = string.Empty;
        public DateTime LastEvaluatedAt { get; init; }
    }
}

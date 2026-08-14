using Dapper;
using Domain.FeatureFlags;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Services.EntityFrameworkCore;

public class ReleaseDecisionFeatureFlagEndUserStatsService(AppDbContext dbContext) : IFeatureFlagEndUserStatsService
{
    public async Task<FeatureFlagEndUserStats> GetFeatureFlagEndUserStatsAsync(FeatureFlagEndUserParam param)
    {
        var from = DateTimeOffset.FromUnixTimeMilliseconds(param.StartTime);
        var to = DateTimeOffset.FromUnixTimeMilliseconds(param.EndTime);
        var query = string.IsNullOrWhiteSpace(param.Query) ? null : $"%{param.Query.Trim()}%";
        var variationId = string.IsNullOrWhiteSpace(param.VariationId) ? null : param.VariationId.Trim();
        var pageSize = Math.Max(param.PageSize, 1);
        var offset = Math.Max(param.PageIndex, 0) * pageSize;

        var sql = """
            WITH evaluations AS
            (
                SELECT
                    user_key AS KeyId,
                    variation_id AS VariationId,
                    max(exposed_at) AS LastEvaluatedAt
                FROM release_decision_exposure_events
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
                LEFT JOIN end_users u ON u.env_id = @EnvGuid AND u.key_id = e.KeyId
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

        var rows = (await dbContext.Database.GetDbConnection().QueryAsync<FeatureFlagEndUserRow>(
            sql,
            new
            {
                EnvId = param.EnvId,
                EnvGuid = param.EnvId,
                param.FeatureFlagKey,
                VariationId = variationId,
                Query = query,
                From = from,
                To = to,
                Offset = offset,
                PageSize = pageSize
            })).ToArray();

        return new FeatureFlagEndUserStats
        {
            TotalCount = rows.FirstOrDefault()?.TotalCount ?? 0,
            Items = rows.Select(x => new FeatureFlagEndUser
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

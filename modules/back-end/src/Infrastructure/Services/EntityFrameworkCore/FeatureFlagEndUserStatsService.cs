using Dapper;
using Domain.FeatureFlags;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Services.EntityFrameworkCore;

public class FeatureFlagEndUserStatsService(AppDbContext dbContext) : IFeatureFlagEndUserStatsService
{
    public async Task<FeatureFlagEndUserStats> GetFeatureFlagEndUserStatsAsync(FeatureFlagEndUserParam param)
    {
        var from = ToUnspecifiedUtcDateTime(param.StartTime);
        var to = ToUnspecifiedUtcDateTime(param.EndTime);
        var query = string.IsNullOrWhiteSpace(param.Query) ? null : $"%{param.Query.Trim()}%";
        var variationId = string.IsNullOrWhiteSpace(param.VariationId) ? null : param.VariationId.Trim();
        var pageSize = Math.Max(param.PageSize, 1);
        var offset = Math.Max(param.PageIndex, 0) * pageSize;

        var sql = """
            WITH evaluations AS
            (
                SELECT
                    properties->>'tag_0' AS KeyId,
                    properties->>'tag_1' AS VariationId,
                    max(timestamp) AS LastEvaluatedAt
                FROM events
                WHERE env_id = @EnvId
                  AND distinct_id = @FlagExptId
                  AND event = 'FlagValue'
                  AND timestamp >= @From
                  AND timestamp <= @To
                  AND properties->>'tag_2' = 'true'
                  AND properties->>'tag_0' IS NOT NULL
                  AND properties->>'tag_1' IS NOT NULL
                  AND (@VariationId IS NULL OR properties->>'tag_1' = @VariationId)
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
                EnvId = param.EnvId.ToString(),
                EnvGuid = param.EnvId,
                param.FlagExptId,
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

    private static DateTime ToUnspecifiedUtcDateTime(long unixMilliseconds)
    {
        var utc = DateTimeOffset.FromUnixTimeMilliseconds(unixMilliseconds).UtcDateTime;
        return DateTime.SpecifyKind(utc, DateTimeKind.Unspecified);
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

using Domain.EndUsers;
using Domain.FeatureFlags;
using Domain.ReleaseDecisions;
using MongoDB.Driver;

namespace Infrastructure.Services.MongoDb;

public class ReleaseDecisionFeatureFlagEndUserStatsService(MongoDbClient mongoDb) : IFeatureFlagEndUserStatsService
{
    public async Task<FeatureFlagEndUserStats> GetFeatureFlagEndUserStatsAsync(FeatureFlagEndUserParam param)
    {
        var start = DateTimeOffset.FromUnixTimeMilliseconds(param.StartTime).UtcDateTime;
        var end = DateTimeOffset.FromUnixTimeMilliseconds(param.EndTime).UtcDateTime;
        var variationId = string.IsNullOrWhiteSpace(param.VariationId) ? null : param.VariationId.Trim();
        var query = param.Query?.Trim();

        var exposureFilter = Builders<ReleaseDecisionExposureEvent>.Filter.And(
            Builders<ReleaseDecisionExposureEvent>.Filter.Eq(x => x.EnvId, param.EnvId),
            Builders<ReleaseDecisionExposureEvent>.Filter.Eq(x => x.FlagKey, param.FeatureFlagKey),
            Builders<ReleaseDecisionExposureEvent>.Filter.Gte(x => x.ExposedAt, start),
            Builders<ReleaseDecisionExposureEvent>.Filter.Lte(x => x.ExposedAt, end),
            Builders<ReleaseDecisionExposureEvent>.Filter.Ne(x => x.UserKey, null),
            Builders<ReleaseDecisionExposureEvent>.Filter.Ne(x => x.VariationId, null)
        );

        if (!string.IsNullOrWhiteSpace(variationId))
        {
            exposureFilter &= Builders<ReleaseDecisionExposureEvent>.Filter.Eq(x => x.VariationId, variationId);
        }

        var exposureDocs = await mongoDb.CollectionOf<ReleaseDecisionExposureEvent>()
            .Find(exposureFilter)
            .ToListAsync();

        var evaluations = exposureDocs
            .Where(x => !string.IsNullOrWhiteSpace(x.UserKey) && !string.IsNullOrWhiteSpace(x.VariationId))
            .GroupBy(x => new { x.UserKey, x.VariationId })
            .Select(x => x.MaxBy(y => y.ExposedAt)!)
            .ToArray();

        var keyIds = evaluations.Select(x => x.UserKey).Distinct().ToArray();
        var endUsers = keyIds.Length == 0
            ? new Dictionary<string, EndUser>()
            : (await mongoDb.CollectionOf<EndUser>()
                .Find(Builders<EndUser>.Filter.And(
                    Builders<EndUser>.Filter.Eq(x => x.EnvId, param.EnvId),
                    Builders<EndUser>.Filter.In(x => x.KeyId, keyIds)
                ))
                .ToListAsync())
            .GroupBy(x => x.KeyId)
            .ToDictionary(x => x.Key, x => x.First());

        var items = evaluations
            .Select(x =>
            {
                endUsers.TryGetValue(x.UserKey, out var endUser);

                return new FeatureFlagEndUser
                {
                    VariationId = x.VariationId,
                    KeyId = x.UserKey,
                    Name = string.IsNullOrWhiteSpace(endUser?.Name) ? x.UserKey : endUser.Name,
                    LastEvaluatedAt = x.ExposedAt.ToString("O")
                };
            })
            .Where(x => MatchesQuery(x, query))
            .OrderByDescending(x => x.LastEvaluatedAt)
            .ThenBy(x => x.KeyId)
            .ToArray();

        var pageSize = Math.Max(param.PageSize, 1);
        var offset = Math.Max(param.PageIndex, 0) * pageSize;

        return new FeatureFlagEndUserStats
        {
            TotalCount = items.Length,
            Items = items.Skip(offset).Take(pageSize).ToArray()
        };
    }

    private static bool MatchesQuery(FeatureFlagEndUser item, string? query)
    {
        return string.IsNullOrWhiteSpace(query) ||
               item.KeyId.Contains(query, StringComparison.OrdinalIgnoreCase) ||
               item.Name.Contains(query, StringComparison.OrdinalIgnoreCase);
    }
}

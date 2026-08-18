using Application.EndUsers;
using Domain.EndUsers;
using Domain.Experiments;
using MongoDB.Driver;

namespace Infrastructure.Services.MongoDb;

public class EndUserStatsService(MongoDbClient mongoDb) : IEndUserStatsService
{
    public async Task<EndUserStats> GetEndUserStatsAsync(Guid envId, EndUserStatsFilter filter)
    {
        var start = DateTimeOffset.FromUnixTimeMilliseconds(filter.From).UtcDateTime;
        var end = DateTimeOffset.FromUnixTimeMilliseconds(filter.To).UtcDateTime;
        var variationId = string.IsNullOrWhiteSpace(filter.VariationId) ? null : filter.VariationId.Trim();
        var query = filter.Query?.Trim();

        var exposureFilter = Builders<ExperimentExposureEvent>.Filter.And(
            Builders<ExperimentExposureEvent>.Filter.Eq(x => x.EnvId, envId),
            Builders<ExperimentExposureEvent>.Filter.Eq(x => x.FlagKey, filter.FeatureFlagKey),
            Builders<ExperimentExposureEvent>.Filter.Gte(x => x.ExposedAt, start),
            Builders<ExperimentExposureEvent>.Filter.Lte(x => x.ExposedAt, end),
            Builders<ExperimentExposureEvent>.Filter.Ne(x => x.UserKey, null),
            Builders<ExperimentExposureEvent>.Filter.Ne(x => x.VariationId, null)
        );

        if (!string.IsNullOrWhiteSpace(variationId))
        {
            exposureFilter &= Builders<ExperimentExposureEvent>.Filter.Eq(x => x.VariationId, variationId);
        }

        var exposureDocs = await mongoDb.CollectionOf<ExperimentExposureEvent>()
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
                    Builders<EndUser>.Filter.Eq(x => x.EnvId, envId),
                    Builders<EndUser>.Filter.In(x => x.KeyId, keyIds)
                ))
                .ToListAsync())
            .GroupBy(x => x.KeyId)
            .ToDictionary(x => x.Key, x => x.First());

        var items = evaluations
            .Select(x =>
            {
                endUsers.TryGetValue(x.UserKey, out var endUser);

                return new EndUserStatsItem
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

        var pageSize = Math.Max(filter.PageSize, 1);
        var offset = Math.Max(filter.PageIndex, 0) * pageSize;

        return new EndUserStats
        {
            TotalCount = items.Length,
            Items = items.Skip(offset).Take(pageSize).ToArray()
        };
    }

    private static bool MatchesQuery(EndUserStatsItem item, string? query)
    {
        return string.IsNullOrWhiteSpace(query) ||
               item.KeyId.Contains(query, StringComparison.OrdinalIgnoreCase) ||
               item.Name.Contains(query, StringComparison.OrdinalIgnoreCase);
    }
}

using Domain.EndUsers;
using Domain.FeatureFlags;
using MongoDB.Bson;
using MongoDB.Driver;

namespace Infrastructure.Services.MongoDb;

public class FeatureFlagEndUserStatsService(MongoDbClient mongoDb) : IFeatureFlagEndUserStatsService
{
    public async Task<FeatureFlagEndUserStats> GetFeatureFlagEndUserStatsAsync(FeatureFlagEndUserParam param)
    {
        var start = DateTimeOffset.FromUnixTimeMilliseconds(param.StartTime).UtcDateTime;
        var end = DateTimeOffset.FromUnixTimeMilliseconds(param.EndTime).UtcDateTime;
        var variationId = string.IsNullOrWhiteSpace(param.VariationId) ? null : param.VariationId.Trim();
        var query = param.Query?.Trim();

        var filterBuilder = Builders<BsonDocument>.Filter;
        var flagFilter = filterBuilder.And(
            filterBuilder.Eq("env_id", param.EnvId.ToString()),
            filterBuilder.Eq("distinct_id", param.FlagExptId),
            filterBuilder.Eq("event", "FlagValue"),
            filterBuilder.Gte("timestamp", start),
            filterBuilder.Lte("timestamp", end),
            filterBuilder.Eq("properties.tag_2", "true"),
            filterBuilder.Exists("properties.tag_0", true),
            filterBuilder.Exists("properties.tag_1", true)
        );

        if (!string.IsNullOrWhiteSpace(variationId))
        {
            flagFilter &= filterBuilder.Eq("properties.tag_1", variationId);
        }

        var flagDocs = await mongoDb.CollectionOf("Events")
            .Find(flagFilter)
            .ToListAsync();

        var evaluations = flagDocs
            .Select(ToFlagEvaluation)
            .Where(x => !string.IsNullOrWhiteSpace(x.KeyId) && !string.IsNullOrWhiteSpace(x.VariationId))
            .GroupBy(x => new { x.KeyId, x.VariationId })
            .Select(x => x.MaxBy(y => y.LastEvaluatedAt)!)
            .ToArray();

        var keyIds = evaluations.Select(x => x.KeyId).Distinct().ToArray();
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
                endUsers.TryGetValue(x.KeyId, out var endUser);

                return new FeatureFlagEndUser
                {
                    VariationId = x.VariationId,
                    KeyId = x.KeyId,
                    Name = string.IsNullOrWhiteSpace(endUser?.Name) ? x.KeyId : endUser.Name,
                    LastEvaluatedAt = x.LastEvaluatedAt.ToString("O")
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

    private static FlagEvaluation ToFlagEvaluation(BsonDocument doc)
    {
        var properties = doc.GetValue("properties", new BsonDocument()).AsBsonDocument;

        return new FlagEvaluation
        {
            KeyId = properties.GetValue("tag_0", string.Empty).AsString,
            VariationId = properties.GetValue("tag_1", string.Empty).AsString,
            LastEvaluatedAt = doc.GetValue("timestamp").ToUniversalTime()
        };
    }

    private static bool MatchesQuery(FeatureFlagEndUser item, string? query)
    {
        return string.IsNullOrWhiteSpace(query) ||
               item.KeyId.Contains(query, StringComparison.OrdinalIgnoreCase) ||
               item.Name.Contains(query, StringComparison.OrdinalIgnoreCase);
    }

    private sealed record FlagEvaluation
    {
        public string KeyId { get; init; } = string.Empty;
        public string VariationId { get; init; } = string.Empty;
        public DateTime LastEvaluatedAt { get; init; }
    }
}

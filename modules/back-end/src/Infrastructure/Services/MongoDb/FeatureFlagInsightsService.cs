using Application.FeatureFlags;
using Domain.FeatureFlags;
using MongoDB.Bson;
using MongoDB.Driver;

namespace Infrastructure.Services.MongoDb;

public class FeatureFlagInsightsService(MongoDbClient mongoDb) : IFeatureFlagInsightsService
{
    public async Task<ICollection<Insights>> GetFeatureFlagInsightsAsync(Guid envId, StatsByVariationFilter filter)
    {
        var start = DateTimeOffset.FromUnixTimeMilliseconds(filter.From).UtcDateTime;
        var end = DateTimeOffset.FromUnixTimeMilliseconds(filter.To).UtcDateTime;
        var flagExptId = $"{envId}-{filter.FeatureFlagKey}";

        var query = Builders<BsonDocument>.Filter.And(
            Builders<BsonDocument>.Filter.Eq("env_id", envId.ToString()),
            Builders<BsonDocument>.Filter.Eq("distinct_id", flagExptId),
            Builders<BsonDocument>.Filter.Eq("event", "FlagValue"),
            Builders<BsonDocument>.Filter.Gte("timestamp", start),
            Builders<BsonDocument>.Filter.Lte("timestamp", end),
            Builders<BsonDocument>.Filter.Eq("properties.tag_2", "true"),
            Builders<BsonDocument>.Filter.Exists("properties.tag_1", true)
        );

        var docs = await mongoDb.CollectionOf("Events").Find(query).ToListAsync();

        return docs
            .Select(doc => new
            {
                Bucket = Truncate(doc.GetValue("timestamp").ToUniversalTime(), filter.IntervalType),
                VariationId = doc.GetValue("properties", new BsonDocument())
                    .AsBsonDocument
                    .GetValue("tag_1", string.Empty)
                    .AsString
            })
            .Where(x => !string.IsNullOrWhiteSpace(x.VariationId))
            .GroupBy(x => x.Bucket)
            .OrderBy(x => x.Key)
            .Select(group => new Insights
            {
                Time = group.Key.ToString("O"),
                Variations = group
                    .GroupBy(x => x.VariationId)
                    .Select(x => new VariationInsights { Id = x.Key, Val = x.Count() })
                    .ToArray()
            })
            .ToArray();
    }

    private static DateTime Truncate(DateTime timestamp, string intervalType)
    {
        var utc = timestamp.Kind == DateTimeKind.Utc ? timestamp : timestamp.ToUniversalTime();

        return intervalType switch
        {
            IntervalType.Month => new DateTime(utc.Year, utc.Month, 1, 0, 0, 0, DateTimeKind.Utc),
            IntervalType.Week => StartOfWeek(utc),
            IntervalType.Day => new DateTime(utc.Year, utc.Month, utc.Day, 0, 0, 0, DateTimeKind.Utc),
            IntervalType.Hour => new DateTime(utc.Year, utc.Month, utc.Day, utc.Hour, 0, 0, DateTimeKind.Utc),
            IntervalType.Minute => new DateTime(utc.Year, utc.Month, utc.Day, utc.Hour, utc.Minute, 0, DateTimeKind.Utc),
            _ => throw new ArgumentException($"Unsupported interval type: {intervalType}", nameof(intervalType))
        };
    }

    private static DateTime StartOfWeek(DateTime utc)
    {
        var daysSinceMonday = ((int)utc.DayOfWeek + 6) % 7;
        var monday = utc.Date.AddDays(-daysSinceMonday);
        return DateTime.SpecifyKind(monday, DateTimeKind.Utc);
    }
}

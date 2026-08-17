using System.Text.Json.Nodes;
using Application.FeatureFlags;
using Domain.Experiments;
using Domain.FeatureFlags;
using MongoDB.Bson;
using MongoDB.Driver;

namespace Infrastructure.Services.MongoDb;

public class InsightService(MongoDbClient mongoDb) : IInsightService
{
    private static readonly InsertManyOptions InsertOptions = new()
    {
        BypassDocumentValidation = true,
        IsOrdered = false
    };

    public bool TryParse(string json, out object? insight)
    {
        try
        {
            insight = Parse();
        }
        catch
        {
            insight = null;
        }

        return insight != null;

        object Parse()
        {
            var jsonNode = JsonNode.Parse(json)!.AsObject();

            jsonNode["_id"] = jsonNode["uuid"]!.GetValue<string>();
            jsonNode.Remove("uuid");

            jsonNode["properties"] = JsonNode.Parse(jsonNode["properties"]!.GetValue<string>());

            var timestampInMilliseconds = jsonNode["timestamp"]!.GetValue<long>() / 1000;
            var timestamp = DateTimeOffset.FromUnixTimeMilliseconds(timestampInMilliseconds).UtcDateTime;
            jsonNode["timestamp"] = timestamp;

            var bsonDocument = BsonDocument.Parse(jsonNode.ToJsonString());
            bsonDocument["timestamp"] = timestamp;

            return bsonDocument;
        }
    }

    public async Task AddManyAsync(object[] insights)
    {
        var documents = insights.Cast<BsonDocument>().ToArray();

        var exposures = documents
            .Select(TryBuildExposure)
            .Where(x => x != null)
            .Cast<ExperimentExposureEvent>()
            .ToArray();

        if (exposures.Length > 0)
        {
            await mongoDb.CollectionOf<ExperimentExposureEvent>().InsertManyAsync(exposures, InsertOptions);
        }

        var metrics = documents
            .Select(TryBuildMetric)
            .Where(x => x != null)
            .Cast<ExperimentMetricEvent>()
            .ToArray();

        if (metrics.Length > 0)
        {
            await mongoDb.CollectionOf<ExperimentMetricEvent>().InsertManyAsync(metrics, InsertOptions);
        }
    }

    public async Task<ICollection<Insights>> GetInsightsAsync(Guid envId, InsightFilter filter)
    {
        var start = DateTimeOffset.FromUnixTimeMilliseconds(filter.From).UtcDateTime;
        var end = DateTimeOffset.FromUnixTimeMilliseconds(filter.To).UtcDateTime;

        var docs = await mongoDb.CollectionOf<ExperimentExposureEvent>()
            .Find(x =>
                x.EnvId == envId &&
                x.FlagKey == filter.FeatureFlagKey &&
                x.ExposedAt >= start &&
                x.ExposedAt <= end &&
                x.VariationId != null)
            .ToListAsync();

        return docs
            .Select(doc => new
            {
                Bucket = Truncate(doc.ExposedAt, filter.IntervalType),
                doc.VariationId
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
    
    private static ExperimentExposureEvent? TryBuildExposure(BsonDocument doc)
    {
        if (doc.GetValue("event", string.Empty).AsString != "FlagValue" ||
            !Guid.TryParse(doc.GetValue("env_id", string.Empty).AsString, out var envId))
        {
            return null;
        }

        var properties = doc.GetValue("properties", new BsonDocument()).AsBsonDocument;
        var flagKey = GetString(properties, "featureFlagKey");
        var userKey = GetString(properties, "userKeyId");
        var variationId = GetString(properties, "variationId");

        if (string.IsNullOrWhiteSpace(flagKey) ||
            string.IsNullOrWhiteSpace(userKey) ||
            string.IsNullOrWhiteSpace(variationId))
        {
            return null;
        }

        return new ExperimentExposureEvent
        {
            Id = GetId(doc),
            EnvId = envId,
            FlagKey = flagKey,
            UserKey = userKey,
            VariationId = variationId,
            VariationValue = GetString(properties, "variationValue"),
            ExposedAt = doc.GetValue("timestamp").ToUniversalTime(),
            Properties = properties.ToJson(),
            CreatedAt = DateTime.UtcNow
        };
    }

    private static ExperimentMetricEvent? TryBuildMetric(BsonDocument doc)
    {
        var eventType = doc.GetValue("event", string.Empty).AsString;
        if (eventType == "FlagValue" ||
            !Guid.TryParse(doc.GetValue("env_id", string.Empty).AsString, out var envId))
        {
            return null;
        }

        var properties = doc.GetValue("properties", new BsonDocument()).AsBsonDocument;
        var userKey = GetString(properties, "userKeyId") ?? GetNestedString(properties, "user", "keyId");
        var eventName = GetString(properties, "eventName") ?? doc.GetValue("distinct_id", string.Empty).AsString;

        if (string.IsNullOrWhiteSpace(userKey) || string.IsNullOrWhiteSpace(eventName))
        {
            return null;
        }

        return new ExperimentMetricEvent
        {
            Id = GetId(doc),
            EnvId = envId,
            UserKey = userKey,
            EventName = eventName,
            EventType = eventType,
            NumericValue = GetNumericValue(properties),
            OccurredAt = doc.GetValue("timestamp").ToUniversalTime(),
            Properties = properties.ToJson(),
            CreatedAt = DateTime.UtcNow
        };
    }

    private static Guid GetId(BsonDocument doc)
    {
        var value = doc.GetValue("_id", BsonNull.Value);
        return value.BsonType switch
        {
            BsonType.Binary => value.AsBsonBinaryData.ToGuid(),
            BsonType.String when Guid.TryParse(value.AsString, out var id) => id,
            _ => Guid.NewGuid()
        };
    }

    private static string? GetString(BsonDocument doc, string key)
    {
        if (!doc.TryGetValue(key, out var value) || value.IsBsonNull)
        {
            return null;
        }

        return value.IsString ? value.AsString : value.ToString();
    }

    private static string? GetNestedString(BsonDocument doc, string objectKey, string key)
    {
        return doc.TryGetValue(objectKey, out var nested) && nested.IsBsonDocument
            ? GetString(nested.AsBsonDocument, key)
            : null;
    }

    private static double GetNumericValue(BsonDocument properties)
    {
        if (properties.TryGetValue("numericValue", out var numericValue) && numericValue.IsNumeric)
        {
            return numericValue.ToDouble();
        }

        return 0;
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

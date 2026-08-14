using Domain.ReleaseDecisions;
using MongoDB.Bson;
using MongoDB.Driver;

namespace Infrastructure.Services.MongoDb;

internal static class ReleaseDecisionInsightWriter
{
    private static readonly InsertManyOptions InsertOptions = new()
    {
        BypassDocumentValidation = true,
        IsOrdered = false
    };

    public static async Task WriteAsync(MongoDbClient mongoDb, BsonDocument[] documents)
    {
        var exposures = documents
            .Select(TryBuildExposure)
            .Where(x => x != null)
            .Cast<ReleaseDecisionExposureEvent>()
            .ToArray();

        if (exposures.Length > 0)
        {
            await mongoDb.CollectionOf<ReleaseDecisionExposureEvent>()
                .InsertManyAsync(exposures, InsertOptions);
        }

        var metrics = documents
            .Select(TryBuildMetric)
            .Where(x => x != null)
            .Cast<ReleaseDecisionMetricEvent>()
            .ToArray();

        if (metrics.Length > 0)
        {
            await mongoDb.CollectionOf<ReleaseDecisionMetricEvent>()
                .InsertManyAsync(metrics, InsertOptions);
        }
    }

    private static ReleaseDecisionExposureEvent? TryBuildExposure(BsonDocument doc)
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

        return new ReleaseDecisionExposureEvent
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

    private static ReleaseDecisionMetricEvent? TryBuildMetric(BsonDocument doc)
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

        return new ReleaseDecisionMetricEvent
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
}

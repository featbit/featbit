using System.Globalization;
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
            .Cast<BsonDocument>()
            .ToArray();

        if (exposures.Length > 0)
        {
            await mongoDb.CollectionOf("ReleaseDecisionExposureEvents")
                .InsertManyAsync(exposures, InsertOptions);
        }

        var metrics = documents
            .Select(TryBuildMetric)
            .Where(x => x != null)
            .Cast<BsonDocument>()
            .ToArray();

        if (metrics.Length > 0)
        {
            await mongoDb.CollectionOf("ReleaseDecisionMetricEvents")
                .InsertManyAsync(metrics, InsertOptions);
        }
    }

    private static BsonDocument? TryBuildExposure(BsonDocument doc)
    {
        if (doc.GetValue("event", string.Empty).AsString != "FlagValue")
        {
            return null;
        }

        var properties = doc.GetValue("properties", new BsonDocument()).AsBsonDocument;
        var flagKey = GetString(properties, "featureFlagKey");
        var userKey = GetString(properties, "tag_0");
        var variationId = GetString(properties, "tag_1");

        if (string.IsNullOrWhiteSpace(flagKey) ||
            string.IsNullOrWhiteSpace(userKey) ||
            string.IsNullOrWhiteSpace(variationId))
        {
            return null;
        }

        return new BsonDocument
        {
            ["_id"] = doc.GetValue("_id"),
            ["envId"] = doc.GetValue("env_id", string.Empty).AsString,
            ["flagKey"] = flagKey,
            ["userKey"] = userKey,
            ["variationId"] = variationId,
            ["variationValue"] = ToBsonValueOrNull(GetString(properties, "variationValue")),
            ["exposedAt"] = doc.GetValue("timestamp").ToUniversalTime(),
            ["properties"] = properties,
            ["createdAt"] = DateTime.UtcNow
        };
    }

    private static BsonDocument? TryBuildMetric(BsonDocument doc)
    {
        var eventType = doc.GetValue("event", string.Empty).AsString;
        if (eventType == "FlagValue")
        {
            return null;
        }

        var properties = doc.GetValue("properties", new BsonDocument()).AsBsonDocument;
        var userKey = GetString(properties, "tag_0");
        var eventName = GetString(properties, "eventName") ?? doc.GetValue("distinct_id", string.Empty).AsString;

        if (string.IsNullOrWhiteSpace(userKey) || string.IsNullOrWhiteSpace(eventName))
        {
            return null;
        }

        return new BsonDocument
        {
            ["_id"] = doc.GetValue("_id"),
            ["envId"] = doc.GetValue("env_id", string.Empty).AsString,
            ["userKey"] = userKey,
            ["eventName"] = eventName,
            ["eventType"] = eventType,
            ["numericValue"] = GetNumericValue(properties),
            ["occurredAt"] = doc.GetValue("timestamp").ToUniversalTime(),
            ["properties"] = properties,
            ["createdAt"] = DateTime.UtcNow
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

    private static BsonValue ToBsonValueOrNull(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? BsonNull.Value : value;
    }

    private static double GetNumericValue(BsonDocument properties)
    {
        if (properties.TryGetValue("numericValue", out var numericValue) && numericValue.IsNumeric)
        {
            return numericValue.ToDouble();
        }

        return properties.TryGetValue("tag_1", out var tagValue) &&
               double.TryParse(tagValue.ToString(), NumberStyles.Float, CultureInfo.InvariantCulture, out var parsed)
            ? parsed
            : 0;
    }
}

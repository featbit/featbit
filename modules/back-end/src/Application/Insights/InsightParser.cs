using System.Text.Json;
using Domain.Experiments;

namespace Application.Insights;

public class InsightParser
{
    public static bool TryParse(string json, out object insight)
    {
        try
        {
            insight = Parse(json);
        }
        catch
        {
            insight = null;
        }

        return insight != null;
    }

    private static object Parse(string json)
    {
        using var jsonDocument = JsonDocument.Parse(json);
        var root = jsonDocument.RootElement;

        if (!root.TryGetProperty("schema_version", out var version) ||
            version.ValueKind != JsonValueKind.Number ||
            !version.TryGetInt32(out var schemaVersion) || schemaVersion != 2)
        {
            return null;
        }

        var id = root.GetProperty("uuid").GetGuid();
        var envId = root.GetProperty("env_id").GetString();
        var eventName = root.GetProperty("event").GetString();
        var properties = root.GetProperty("properties");
        var timestampMs = root.GetProperty("timestamp").GetInt64();
        var timestamp = DateTimeOffset.FromUnixTimeMilliseconds(timestampMs).UtcDateTime;

        return eventName == "FlagValue"
            ? TryBuildExposure(id, envId, properties, timestamp)
            : TryBuildMetric(id, envId, eventName, properties, timestamp);
    }

    private static ExperimentExposureEvent TryBuildExposure(
        Guid id,
        string envId,
        JsonElement properties,
        DateTime timestamp)
    {
        if (!Guid.TryParse(envId, out var parsedEnvId) || properties.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        var root = properties;
        var flagKey = GetString(root, "featureFlagKey");
        var userKey = GetString(root, "userKeyId");
        var variationId = GetString(root, "variationId");

        if (string.IsNullOrWhiteSpace(flagKey) ||
            string.IsNullOrWhiteSpace(userKey) ||
            string.IsNullOrWhiteSpace(variationId))
        {
            return null;
        }

        return new ExperimentExposureEvent
        {
            Id = id,
            EnvId = parsedEnvId,
            FlagKey = flagKey,
            UserKey = userKey,
            VariationId = variationId,
            VariationValue = GetString(root, "variationValue"),
            ExposedAt = timestamp,
            CreatedAt = DateTime.UtcNow
        };
    }

    private static ExperimentMetricEvent TryBuildMetric(
        Guid id,
        string envId,
        string eventType,
        JsonElement properties,
        DateTime timestamp)
    {
        if (!Guid.TryParse(envId, out var parsedEnvId) ||
            string.IsNullOrWhiteSpace(eventType) ||
            properties.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        var root = properties;
        var userKey = GetString(root, "userKeyId");
        var eventName = GetString(root, "eventName");

        if (string.IsNullOrWhiteSpace(userKey) || string.IsNullOrWhiteSpace(eventName))
        {
            return null;
        }

        return new ExperimentMetricEvent
        {
            Id = id,
            EnvId = parsedEnvId,
            UserKey = userKey,
            EventName = eventName,
            EventType = eventType,
            NumericValue = GetNumericValue(root),
            ApplicationType = GetString(root, "applicationType"),
            OccurredAt = timestamp,
            CreatedAt = DateTime.UtcNow
        };
    }

    private static string GetString(JsonElement element, string property)
    {
        return element.TryGetProperty(property, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : null;
    }

    private static double GetNumericValue(JsonElement properties)
    {
        if (properties.TryGetProperty("numericValue", out var numericValue) &&
            numericValue.ValueKind == JsonValueKind.Number &&
            numericValue.TryGetDouble(out var parsed))
        {
            return parsed;
        }

        return 0;
    }
}

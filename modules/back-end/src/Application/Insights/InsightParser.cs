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
        
        var envIdString = root.GetProperty("env_id").GetString();
        if (!Guid.TryParse(envIdString, out var envId))
        {
            return null;
        }
        
        var eventName = root.GetProperty("event").GetString();
        if (string.IsNullOrWhiteSpace(eventName))
        {
            return null;
        }

        var id = root.GetProperty("uuid").GetGuid();
        var properties = root.GetProperty("properties").GetString();
        var timestampMs = root.GetProperty("timestamp").GetInt64() / 1000;
        var timestamp = DateTimeOffset.FromUnixTimeMilliseconds(timestampMs).UtcDateTime;

        return eventName == "FlagValue"
            ? TryBuildExposure(id, envId, properties, timestamp)
            : TryBuildMetric(id, envId, eventName, properties, timestamp);
    }

    private static ExperimentExposureEvent TryBuildExposure(
        Guid id,
        Guid envId,
        string properties,
        DateTime timestamp)
    {
        using var document = JsonDocument.Parse(properties);
        var root = document.RootElement;
        if (root.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

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
            EnvId = envId,
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
        Guid envId,
        string eventType,
        string properties,
        DateTime timestamp)
    {
        using var document = JsonDocument.Parse(properties);
        var root = document.RootElement;
        if (root.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        var userKey = GetNestedString(root, "user", "keyId");
        var eventName = GetString(root, "eventName");

        if (string.IsNullOrWhiteSpace(userKey) || string.IsNullOrWhiteSpace(eventName))
        {
            return null;
        }

        return new ExperimentMetricEvent
        {
            Id = id,
            EnvId = envId,
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

    private static string GetNestedString(JsonElement element, string objectProperty, string property)
    {
        return element.TryGetProperty(objectProperty, out var nested) && nested.ValueKind == JsonValueKind.Object
            ? GetString(nested, property)
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

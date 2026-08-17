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

        var id = root.GetProperty("uuid").GetGuid();
        var distinctId = root.GetProperty("distinct_id").GetString();
        var envId = root.GetProperty("env_id").GetString();
        var eventName = root.GetProperty("event").GetString();
        var properties = root.GetProperty("properties").GetString();
        var timestampMs = root.GetProperty("timestamp").GetInt64() / 1000;
        var timestamp = DateTimeOffset.FromUnixTimeMilliseconds(timestampMs).UtcDateTime;

        return eventName == "FlagValue"
            ? TryBuildExposure(id, envId, properties, timestamp)
            : TryBuildMetric(id, distinctId, envId, eventName, properties, timestamp);
    }

    private static ExperimentExposureEvent TryBuildExposure(
        Guid id,
        string envId,
        string properties,
        DateTime timestamp)
    {
        if (!Guid.TryParse(envId, out var parsedEnvId) || string.IsNullOrWhiteSpace(properties))
        {
            return null;
        }

        using var document = JsonDocument.Parse(properties);
        var root = document.RootElement;
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
            Properties = properties,
            CreatedAt = DateTime.UtcNow
        };
    }

    private static ExperimentMetricEvent TryBuildMetric(
        Guid id,
        string distinctId,
        string envId,
        string eventType,
        string properties,
        DateTime timestamp)
    {
        if (!Guid.TryParse(envId, out var parsedEnvId) ||
            string.IsNullOrWhiteSpace(eventType) ||
            string.IsNullOrWhiteSpace(properties))
        {
            return null;
        }

        using var document = JsonDocument.Parse(properties);
        var root = document.RootElement;
        var userKey = GetString(root, "userKeyId") ?? GetNestedString(root, "user", "keyId");
        var eventName = GetString(root, "eventName") ?? distinctId;

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
            OccurredAt = timestamp,
            Properties = properties,
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

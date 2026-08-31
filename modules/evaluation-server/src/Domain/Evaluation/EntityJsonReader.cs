using System.Text.Json;
using Domain.Shared;

namespace Domain.Evaluation;

public enum EvaluationEntityType
{
    FeatureFlag,
    Segment
}

public sealed class MalformedDataException : Exception
{
    public EvaluationEntityType EntityType { get; }

    public string? EntityId { get; }

    public string? PropertyPath { get; }

    public MalformedDataException(
        EvaluationEntityType entityType,
        string? entityId,
        string message,
        string? propertyPath = null,
        Exception? innerException = null)
        : base(message, innerException)
    {
        EntityType = entityType;
        EntityId = entityId;
        PropertyPath = propertyPath;
    }
}

public sealed class EntityJsonReader(EvaluationEntityType entityType, string? entityId = null)
{
    public static EntityJsonReader FeatureFlag { get; } = new(EvaluationEntityType.FeatureFlag);
    public static EntityJsonReader ForSegment(string segmentId) => new(EvaluationEntityType.Segment, segmentId);

    public static string? TryGetString(JsonElement json, string propertyName) =>
        json.ValueKind == JsonValueKind.Object &&
        json.TryGetProperty(propertyName, out var property) &&
        property.ValueKind == JsonValueKind.String
            ? property.GetString()
            : null;

    public JsonDocument Parse(ReadOnlyMemory<byte> json)
    {
        try
        {
            return JsonDocument.Parse(json);
        }
        catch (JsonException ex)
        {
            throw Malformed("Entity is not valid JSON", innerException: ex);
        }
    }

    public bool GetRequiredBoolean(JsonElement json, string propertyName)
    {
        var property = GetRequiredProperty(json, propertyName);
        if (property.ValueKind is not (JsonValueKind.True or JsonValueKind.False))
        {
            throw WrongType(propertyName, "boolean", property.ValueKind);
        }

        return property.GetBoolean();
    }

    public string GetRequiredString(JsonElement json, string propertyName)
    {
        var property = GetRequiredProperty(json, propertyName);
        return GetRequiredStringValue(property, propertyName);
    }

    public string? GetNullableString(JsonElement json, string propertyName)
    {
        var property = GetRequiredProperty(json, propertyName);
        if (property.ValueKind == JsonValueKind.Null)
        {
            return null;
        }

        if (property.ValueKind != JsonValueKind.String)
        {
            throw WrongType(propertyName, "string or null", property.ValueKind);
        }

        return property.GetString();
    }

    public double GetRequiredDouble(JsonElement json, string propertyName)
    {
        var property = GetRequiredProperty(json, propertyName);
        if (property.ValueKind != JsonValueKind.Number || !property.TryGetDouble(out var value))
        {
            throw WrongType(propertyName, "number", property.ValueKind);
        }

        return value;
    }

    public JsonElement GetRequiredArray(JsonElement json, string propertyName)
    {
        var property = GetRequiredProperty(json, propertyName);
        if (property.ValueKind != JsonValueKind.Array)
        {
            throw WrongType(propertyName, "array", property.ValueKind);
        }

        return property;
    }

    public T[] DeserializeRequiredArray<T>(JsonElement json, string propertyName)
    {
        var property = GetRequiredArray(json, propertyName);
        try
        {
            return property.Deserialize<T[]>(ReusableJsonSerializerOptions.Web) ??
                   throw Malformed($"Property '{propertyName}' must not be null", propertyName);
        }
        catch (JsonException ex)
        {
            throw Malformed($"Property '{propertyName}' contains invalid values", propertyName, ex);
        }
    }

    public string[] DeserializeStringArray(string json, string propertyName)
    {
        try
        {
            var values = JsonSerializer.Deserialize<string[]>(json);
            if (values == null || values.Any(string.IsNullOrWhiteSpace))
            {
                throw Malformed(
                    $"Property '{propertyName}' must contain non-empty strings",
                    propertyName
                );
            }

            return values;
        }
        catch (JsonException ex)
        {
            throw Malformed($"Property '{propertyName}' must be an array of strings", propertyName, ex);
        }
    }

    public JsonElement GetRequiredObject(JsonElement json, string propertyName)
    {
        var property = GetRequiredProperty(json, propertyName);
        if (property.ValueKind != JsonValueKind.Object)
        {
            throw WrongType(propertyName, "object", property.ValueKind);
        }

        return property;
    }

    public DateTimeOffset GetRequiredDateTimeOffset(JsonElement json, string propertyName)
    {
        var property = GetRequiredProperty(json, propertyName);
        if (property.ValueKind != JsonValueKind.String || !property.TryGetDateTimeOffset(out var value))
        {
            throw WrongType(propertyName, "ISO-8601 date-time string", property.ValueKind);
        }

        return value;
    }

    public string GetRequiredStringValue(JsonElement json, string path)
    {
        if (json.ValueKind != JsonValueKind.String)
        {
            throw WrongType(path, "string", json.ValueKind);
        }

        return json.GetString()!;
    }

    public MalformedDataException Malformed(
        string message,
        string? propertyPath = null,
        Exception? innerException = null) =>
        new(entityType, entityId, message, propertyPath, innerException);

    private JsonElement GetRequiredProperty(JsonElement json, string propertyName)
    {
        if (json.ValueKind != JsonValueKind.Object)
        {
            throw Malformed(
                $"Cannot read property '{propertyName}' from JSON value of type '{json.ValueKind}'",
                propertyName
            );
        }

        if (!json.TryGetProperty(propertyName, out var propertyValue))
        {
            throw Malformed($"Missing required property '{propertyName}'", propertyName);
        }

        return propertyValue;
    }

    private MalformedDataException WrongType(
        string propertyName,
        string expectedType,
        JsonValueKind actualType) =>
        Malformed(
            $"Property '{propertyName}' is expected to be of type '{expectedType}', but was '{actualType}'",
            propertyName
        );
}

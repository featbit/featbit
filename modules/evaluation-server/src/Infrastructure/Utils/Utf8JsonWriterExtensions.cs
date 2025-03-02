using System.Text.Json;

namespace Infrastructure.Utils;

public static class Utf8JsonWriterExtensions
{
    public static void WriteJsonString(this Utf8JsonWriter writer, string propertyName, string? jsonString)
    {
        if (jsonString is null)
        {
            writer.WriteNull(propertyName);
            return;
        }

        writer.WritePropertyName(propertyName);
        writer.WriteRawValue(jsonString, skipInputValidation: true);
    }

    public static void WriteStringArray(this Utf8JsonWriter writer, string propertyName, string[]? values)
    {
        if (values is null)
        {
            writer.WriteNull(propertyName);
            return;
        }

        writer.WriteStartArray(propertyName);
        foreach (var item in values)
        {
            writer.WriteStringValue(item);
        }

        writer.WriteEndArray();
    }
}
using System.Text.Json;

namespace Domain.Utils;

public static class JsonExtensions
{
    public static bool IsEmptyObject(this JsonElement json)
        => json.ValueKind == JsonValueKind.Object && !json.EnumerateObject().Any();
}
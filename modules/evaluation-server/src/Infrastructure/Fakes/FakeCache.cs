using System.Collections.Immutable;
using System.Text;
using System.Text.Json.Nodes;

namespace Infrastructure.Fakes;

public static class FakeCache
{
    public static IEnumerable<byte[]> AllFlags { get; private set; } = Array.Empty<byte[]>();

    public static IEnumerable<byte[]> AllSegments { get; private set; } = Array.Empty<byte[]>();

    public static ImmutableDictionary<string, byte[]> FlagsMap { get; private set; } = null!;

    public static ImmutableDictionary<string, byte[]> SegmentsMap { get; private set; } = null!;

    public static void Populate(
        JsonArray flags,
        JsonArray segments)
    {
        AllFlags = flags.Select(JsonObjectToUtf8Bytes());
        AllSegments = segments.Select(JsonObjectToUtf8Bytes());

        FlagsMap = JsonArrayToMap(flags);
        SegmentsMap = JsonArrayToMap(segments);
    }

    private static ImmutableDictionary<string, byte[]> JsonArrayToMap(JsonArray jArray)
    {
        var dictionary = jArray.ToImmutableDictionary(
            x => x!["id"]!.ToString(),
            JsonObjectToUtf8Bytes()
        );

        return dictionary;
    }

    private static Func<JsonNode?, byte[]> JsonObjectToUtf8Bytes()
    {
        return x => Encoding.UTF8.GetBytes(x!.AsObject().ToJsonString());
    }
}
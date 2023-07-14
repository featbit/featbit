using System.Collections.Immutable;
using System.Text;
using System.Text.Json.Nodes;

namespace Infrastructure.Fakes;

public static class FakeData
{
    public static IEnumerable<byte[]> AllFlags { get; private set; }

    public static IEnumerable<byte[]> AllSegments { get; private set; }

    public static ImmutableDictionary<string, byte[]> FlagsMap { get; private set; }

    public static ImmutableDictionary<string, byte[]> SegmentsMap { get; private set; }

    static FakeData()
    {
        var flags = ReadJsonArray("flags.json");
        var segments = ReadJsonArray("segments.json");

        AllFlags = flags.Select(JsonObjectToUtf8Bytes());
        AllSegments = segments.Select(JsonObjectToUtf8Bytes());

        FlagsMap = JsonArrayToMap(flags);
        SegmentsMap = JsonArrayToMap(segments);
    }

    private static JsonArray ReadJsonArray(string path)
    {
        var jString = File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Fakes", path));
        var jArray = JsonNode.Parse(jString)!.AsArray();

        return jArray;
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
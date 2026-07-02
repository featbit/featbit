using System.Collections.Immutable;
using System.Text;
using System.Text.Json.Nodes;
using Domain.Shared;

namespace Infrastructure.Fakes;

public static class FakeData
{
    public static readonly Guid EnvId = new Guid("226b9bf8-4af3-4ffa-9b01-162270e4cd40");

    public static ImmutableArray<KeyValuePair<long, byte[]>> AllFlags { get; private set; }

    public static ImmutableArray<KeyValuePair<long, byte[]>> AllSegments { get; private set; }

    public static ImmutableDictionary<string, byte[]> FlagsMap { get; private set; }

    public static ImmutableDictionary<string, byte[]> SegmentsMap { get; private set; }

    private static readonly SecretWithValue[] RpSecrets =
    [
        new()
        {
            Type = SecretTypes.Server,
            ProjectKey = "webapp",
            EnvId = EnvId,
            EnvKey = "dev",
            Value = "E0ZC__zC8EeQoxEDF-iR9g-JtrIvNK-k-bARYicOTNQA"
        },
        new()
        {
            Type = SecretTypes.Client,
            ProjectKey = "webapp",
            EnvId = EnvId,
            EnvKey = "dev",
            Value = "0kqduqWZkESt2VSgsd9tEQ-JtrIvNK-k-bARYicOTNQA"
        }
    ];

    static FakeData()
    {
        var flags = ReadJsonArray("flags.json");
        var segments = ReadJsonArray("segments.json");

        AllFlags =
        [
            ..JsonArrayToDictionary(flags, x => x["updatedAt"]!.GetValue<DateTimeOffset>().ToUnixTimeMilliseconds())
        ];
        AllSegments =
        [
            ..JsonArrayToDictionary(segments, x => x["updatedAt"]!.GetValue<DateTimeOffset>().ToUnixTimeMilliseconds())
        ];

        FlagsMap = JsonArrayToDictionary(flags, x => x["id"]!.ToString());
        SegmentsMap = JsonArrayToDictionary(segments, x => x["id"]!.ToString());
    }

    private static JsonArray ReadJsonArray(string path)
    {
        var jString = File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Fakes", path));
        var jArray = JsonNode.Parse(jString)!.AsArray();

        return jArray;
    }

    private static ImmutableDictionary<TKey, byte[]> JsonArrayToDictionary<TKey>(
        JsonArray jArray,
        Func<JsonNode, TKey> keySelector) where TKey : notnull
    {
        var dictionary = jArray.ToImmutableDictionary(
            x => keySelector(x!),
            JsonObjectToUtf8Bytes()
        );

        return dictionary;
    }

    private static Func<JsonNode?, byte[]> JsonObjectToUtf8Bytes()
    {
        return x => Encoding.UTF8.GetBytes(x!.AsObject().ToJsonString());
    }

    public static SecretWithValue[] GetRpSecrets(string secretString)
    {
        return secretString switch
        {
            TestData.RelayProxyTokenString => RpSecrets,
            _ => []
        };
    }
}
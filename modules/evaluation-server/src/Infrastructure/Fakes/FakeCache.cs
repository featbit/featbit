using System.Text;
using System.Text.Json.Nodes;

namespace Infrastructure.Fakes;

public static class FakeCache
{
    public static IEnumerable<byte[]> FlagsBytes { get; private set; } = Array.Empty<byte[]>();

    public static IEnumerable<byte[]> SegmentsBytes { get; private set; } = Array.Empty<byte[]>();

    public static JsonArray Flags { get; private set; } = null!;

    public static JsonArray Segments { get; private set; } = null!;

    public static void Populate(JsonArray flags, JsonArray segments)
    {
        Flags = flags;
        Segments = segments;

        FlagsBytes = flags.Select(x => Encoding.UTF8.GetBytes(x!.ToJsonString())).ToArray();
        SegmentsBytes = segments.Select(x => Encoding.UTF8.GetBytes(x!.ToJsonString())).ToArray();
    }
}
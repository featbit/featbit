using System.Collections.Immutable;
using System.Text;
using System.Text.Json.Nodes;

namespace Infrastructure.Fakes;

public static class FakeCache
{
    public static IEnumerable<byte[]> FlagsBytes { get; private set; } = Array.Empty<byte[]>();

    public static IEnumerable<byte[]> SegmentsBytes { get; private set; } = Array.Empty<byte[]>();

    public static ImmutableDictionary<string, JsonObject> Flags { get; private set; } = null!;

    public static ImmutableDictionary<string, JsonObject> Segments { get; private set; } = null!;

    public static void Populate(
        ImmutableDictionary<string, JsonObject> flags,
        ImmutableDictionary<string, JsonObject> segments)
    {
        Flags = flags;
        Segments = segments;

        FlagsBytes = flags.Values.Select(x => Encoding.UTF8.GetBytes(x.ToJsonString())).ToArray();
        SegmentsBytes = segments.Values.Select(x => Encoding.UTF8.GetBytes(x.ToJsonString())).ToArray();
    }
}
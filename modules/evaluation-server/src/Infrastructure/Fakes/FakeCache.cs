namespace Infrastructure.Fakes;

public static class FakeCache
{
    public static IEnumerable<byte[]> Flags { get; private set; } = Array.Empty<byte[]>();

    public static IEnumerable<byte[]> Segments { get; private set; } = Array.Empty<byte[]>();

    public static void Populate(IEnumerable<byte[]> flags, IEnumerable<byte[]> segments)
    {
        Flags = flags;
        Segments = segments;
    }
}
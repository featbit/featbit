using StackExchange.Redis;

namespace Infrastructure.Redis;

public static class RedisKeys
{
    private const string FlagPrefix = "featbit:flag:";
    private const string FlagIndexPrefix = "featbit:flag.index:";
    private const string SegmentPrefix = "featbit:segment:";
    private const string SegmentIndexPrefix = "featbit:segment.index:";

    public static RedisKey FlagIndex(Guid envId) => new($"{FlagIndexPrefix}{envId}");

    public static RedisKey Flag(string id) => new($"{FlagPrefix}{id}");

    public static RedisKey SegmentIndex(Guid envId) => new($"{SegmentIndexPrefix}{envId}");

    public static RedisKey Segment(string id) => new($"{SegmentPrefix}{id}");
}
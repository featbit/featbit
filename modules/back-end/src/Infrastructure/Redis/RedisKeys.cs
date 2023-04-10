using StackExchange.Redis;

namespace Infrastructure.Redis;

public static class RedisKeys
{
    private const string FlagPrefix = "ff_";
    private const string FlagIndexPrefix = "ff_index_";
    private const string SegmentPrefix = "segment_";
    private const string SegmentIndexPrefix = "segment_index_";

    public static RedisKey Flag(Guid id) => new($"{FlagPrefix}{id}");

    public static RedisKey FlagIndex(Guid envId) => new($"{FlagIndexPrefix}{envId}");

    public static RedisKey Segment(Guid id) => new($"{SegmentPrefix}{id}");

    public static RedisKey SegmentIndex(Guid envId) => new($"{SegmentIndexPrefix}{envId}");
}
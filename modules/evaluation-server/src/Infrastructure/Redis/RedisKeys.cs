using StackExchange.Redis;

namespace Infrastructure.Redis;

public class RedisKeyPrefixes
{
    public const string FlagIndex = "ff_index_";

    public const string Flag = "ff_";

    public const string SegmentIndex = "segment_index_";

    public const string Segment = "segment_";
}

public class RedisKeys
{
    public static RedisKey FlagIndex(Guid envId) => new($"{RedisKeyPrefixes.FlagIndex}{envId}");

    public static RedisKey FeatureFlag(Guid id) => new($"{RedisKeyPrefixes.Flag}{id}");

    public static RedisKey FeatureFlag(string id) => new($"{RedisKeyPrefixes.Flag}{id}");

    public static RedisKey SegmentIndex(Guid envId) => new($"{RedisKeyPrefixes.SegmentIndex}{envId}");

    public static RedisKey Segment(Guid id) => new($"{RedisKeyPrefixes.Segment}{id}");

    public static RedisKey Segment(string id) => new($"{RedisKeyPrefixes.Segment}{id}");
}
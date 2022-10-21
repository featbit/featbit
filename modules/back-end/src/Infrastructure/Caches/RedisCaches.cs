using System.Text.Json;
using Domain.FeatureFlags;
using Domain.Segments;
using StackExchange.Redis;

namespace Infrastructure.Caches;

public static class RedisCaches
{
    public static KeyValuePair<RedisKey, RedisValue> Of(FeatureFlag flag)
    {
        var value = new KeyValuePair<RedisKey, RedisValue>(
            RedisKeys.FeatureFlag(flag.Id),
            new RedisValue(JsonSerializer.Serialize(flag))
        );

        return value;
    }

    public static RedisIndexCache IndexOf(FeatureFlag flag)
    {
        var indexCache = new RedisIndexCache
        {
            Key = RedisKeys.FlagIndex(flag.EnvId),
            Value = new RedisValue(flag.Id.ToString()),
            Score = new DateTimeOffset(flag.UpdatedAt).ToUnixTimeMilliseconds()
        };

        return indexCache;
    }

    public static KeyValuePair<RedisKey, RedisValue> Of(Segment segment)
    {
        var value = new KeyValuePair<RedisKey, RedisValue>(
            RedisKeys.Segment(segment.Id),
            new RedisValue(JsonSerializer.Serialize(segment))
        );

        return value;
    }

    public static RedisIndexCache IndexOf(Segment segment)
    {
        var indexCache = new RedisIndexCache
        {
            Key = RedisKeys.SegmentIndex(segment.EnvId),
            Value = new RedisValue(segment.Id.ToString()),
            Score = new DateTimeOffset(segment.UpdatedAt).ToUnixTimeMilliseconds()
        };

        return indexCache;
    }
}
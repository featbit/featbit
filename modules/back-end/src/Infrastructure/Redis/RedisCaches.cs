using System.Text.Json;
using Domain.FeatureFlags;
using Domain.Segments;
using Domain.Utils;
using StackExchange.Redis;

namespace Infrastructure.Redis;

public static class RedisCaches
{
    public static KeyValuePair<RedisKey, RedisValue> Flag(FeatureFlag flag)
    {
        var key = RedisKeys.Flag(flag.Id);
        var value = JsonSerializer.SerializeToUtf8Bytes(flag, ReusableJsonSerializerOptions.Web);

        return new KeyValuePair<RedisKey, RedisValue>(key, value);
    }

    public static RedisIndex FlagIndex(FeatureFlag flag)
    {
        var index = new RedisIndex
        {
            Key = RedisKeys.FlagIndex(flag.EnvId),
            Member = flag.Id.ToString(),
            Score = new DateTimeOffset(flag.UpdatedAt).ToUnixTimeMilliseconds()
        };

        return index;
    }

    public static KeyValuePair<RedisKey, RedisValue> Segment(Segment segment)
    {
        var key = RedisKeys.Segment(segment.Id);
        var value = JsonSerializer.SerializeToUtf8Bytes(segment, ReusableJsonSerializerOptions.Web);

        return new KeyValuePair<RedisKey, RedisValue>(key, value);
    }

    public static RedisIndex SegmentIndex(Segment segment)
    {
        var index = new RedisIndex
        {
            Key = RedisKeys.SegmentIndex(segment.EnvId),
            Member = segment.Id.ToString(),
            Score = new DateTimeOffset(segment.UpdatedAt).ToUnixTimeMilliseconds()
        };

        return index;
    }
}
using System.Text.Json;
using Domain.FeatureFlags;
using Domain.Segments;
using Domain.Utils;
using StackExchange.Redis;

namespace Infrastructure.Caches.Redis;

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

    /// <summary>
    /// Builds the versioned staged value entry for <paramref name="flag"/> scored by
    /// <paramref name="ts"/>. Mirrors <see cref="Flag(FeatureFlag)"/> serialization.
    /// </summary>
    public static KeyValuePair<RedisKey, RedisValue> FlagStaged(FeatureFlag flag, long ts)
    {
        var key = RedisKeys.FlagVersion(flag.Id, ts);
        var value = JsonSerializer.SerializeToUtf8Bytes(flag, ReusableJsonSerializerOptions.Web);

        return new KeyValuePair<RedisKey, RedisValue>(key, value);
    }

    public static KeyValuePair<RedisKey, RedisValue> Segment(Segment segment)
    {
        var key = RedisKeys.Segment(segment.Id);

        var json = segment.SerializeAsEnvironmentSpecific();
        var value = JsonSerializer.SerializeToUtf8Bytes(json);

        return new KeyValuePair<RedisKey, RedisValue>(key, value);
    }

    public static RedisIndex SegmentIndex(Guid envId, Segment segment)
    {
        var index = new RedisIndex
        {
            Key = RedisKeys.SegmentIndex(envId),
            Member = segment.Id.ToString(),
            Score = new DateTimeOffset(segment.UpdatedAt).ToUnixTimeMilliseconds()
        };

        return index;
    }

    /// <summary>
    /// Builds the versioned staged value entry for <paramref name="segment"/> scored by
    /// <paramref name="ts"/>. Mirrors <see cref="Segment(Domain.Segments.Segment)"/> serialization.
    /// </summary>
    public static KeyValuePair<RedisKey, RedisValue> SegmentStaged(Segment segment, long ts)
    {
        var key = RedisKeys.SegmentVersion(segment.Id, ts);

        var json = segment.SerializeAsEnvironmentSpecific();
        var value = JsonSerializer.SerializeToUtf8Bytes(json);

        return new KeyValuePair<RedisKey, RedisValue>(key, value);
    }
}
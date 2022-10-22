using System.Text;
using System.Text.Json;
using MongoDB.Bson;
using StackExchange.Redis;

namespace Infrastructure.Caches;

public static class RedisCaches
{
    public static KeyValuePair<RedisKey, RedisValue> Flag(BsonDocument flag)
    {
        var id = flag["_id"].AsGuid;
        var bytes = Encoding.UTF8.GetBytes(
            JsonSerializer.Serialize(flag.ToDictionary())
        );

        var value = new KeyValuePair<RedisKey, RedisValue>(
            RedisKeys.FeatureFlag(id), bytes
        );

        return value;
    }

    public static RedisIndexCache FlagIndex(BsonDocument flag)
    {
        var id = flag["_id"].AsGuid;
        var envId = flag["envId"].AsGuid;
        var updatedAt = flag["updatedAt"].ToUniversalTime();

        var indexCache = new RedisIndexCache
        {
            Key = RedisKeys.FlagIndex(envId),
            Value = new RedisValue(id.ToString()),
            Score = new DateTimeOffset(updatedAt).ToUnixTimeMilliseconds()
        };

        return indexCache;
    }

    public static KeyValuePair<RedisKey, RedisValue> Segment(BsonDocument segment)
    {
        var id = segment["_id"].AsGuid;
        var bytes = Encoding.UTF8.GetBytes(
            JsonSerializer.Serialize(segment.ToDictionary())
        );

        var value = new KeyValuePair<RedisKey, RedisValue>(
            RedisKeys.Segment(id), bytes
        );

        return value;
    }

    public static RedisIndexCache SegmentIndex(BsonDocument segment)
    {
        var id = segment["_id"].AsGuid;
        var envId = segment["envId"].AsGuid;
        var updatedAt = segment["updatedAt"].ToUniversalTime();

        var indexCache = new RedisIndexCache
        {
            Key = RedisKeys.SegmentIndex(envId),
            Value = new RedisValue(id.ToString()),
            Score = new DateTimeOffset(updatedAt).ToUnixTimeMilliseconds()
        };

        return indexCache;
    }
}
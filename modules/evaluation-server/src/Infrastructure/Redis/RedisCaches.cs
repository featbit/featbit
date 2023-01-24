using System.Text;
using System.Text.Json;
using Infrastructure.MongoDb;
using MongoDB.Bson;
using StackExchange.Redis;

namespace Infrastructure.Redis;

public static class RedisCaches
{
    public static KeyValuePair<RedisKey, RedisValue> Flag(BsonDocument flag)
    {
        var id = flag["_id"].AsGuid;
        var bytes = Encoding.UTF8.GetBytes(flag.AsJson());

        var value = new KeyValuePair<RedisKey, RedisValue>(
            RedisKeys.FeatureFlag(id), bytes
        );

        return value;
    }

    public static KeyValuePair<RedisKey, RedisValue> Flag(JsonElement flag)
    {
        if (!flag.TryGetProperty("id", out var idElement))
        {
            throw new InvalidDataException("invalid flag json");
        }

        var id = idElement.GetGuid();
        var bytes = Encoding.UTF8.GetBytes(flag.GetRawText());

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

    public static RedisIndexCache FlagIndex(JsonElement flag)
    {
        if (!flag.TryGetProperty("id", out var idElement) ||
            !flag.TryGetProperty("envId", out var envIdElement) ||
            !flag.TryGetProperty("updatedAt", out var updatedAtElement))
        {
            throw new InvalidDataException("invalid flag json");
        }

        var id = idElement.GetGuid();
        var envId = envIdElement.GetGuid();
        var updatedAt = updatedAtElement.GetDateTime();

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
        var bytes = Encoding.UTF8.GetBytes(segment.AsJson());

        var value = new KeyValuePair<RedisKey, RedisValue>(
            RedisKeys.Segment(id), bytes
        );

        return value;
    }

    public static KeyValuePair<RedisKey, RedisValue> Segment(JsonElement segment)
    {
        if (!segment.TryGetProperty("id", out var idElement))
        {
            throw new InvalidDataException("invalid segment json");
        }

        var id = idElement.GetGuid();
        var bytes = Encoding.UTF8.GetBytes(segment.GetRawText());

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

    public static RedisIndexCache SegmentIndex(JsonElement segment)
    {
        if (!segment.TryGetProperty("id", out var idElement) ||
            !segment.TryGetProperty("envId", out var envIdElement) ||
            !segment.TryGetProperty("updatedAt", out var updatedAtElement))
        {
            throw new InvalidDataException("invalid segment json");
        }

        var id = idElement.GetGuid();
        var envId = envIdElement.GetGuid();
        var updatedAt = updatedAtElement.GetDateTime();

        var indexCache = new RedisIndexCache
        {
            Key = RedisKeys.SegmentIndex(envId),
            Value = new RedisValue(id.ToString()),
            Score = new DateTimeOffset(updatedAt).ToUnixTimeMilliseconds()
        };

        return indexCache;
    }
}
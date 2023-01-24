using System.Text.Json;
using Infrastructure.Caches;
using MongoDB.Bson;
using StackExchange.Redis;

namespace Infrastructure.Redis;

public class RedisService : ICacheService
{
    private readonly IDatabase _redis;

    public RedisService(IConnectionMultiplexer multiplexer)
    {
        _redis = multiplexer.GetDatabase();
    }

    public async Task<IEnumerable<byte[]>> GetFlagsAsync(Guid envId, long timestamp)
    {
        // get flag keys
        var index = RedisKeys.FlagIndex(envId);
        var ids = await _redis.SortedSetRangeByScoreAsync(index, timestamp, exclude: Exclude.Start);
        var keys = ids.Select(id => RedisKeys.FeatureFlag(id!));

        // get flags
        var tasks = keys.Select(key => _redis.StringGetAsync(key));
        var values = await Task.WhenAll(tasks);
        var jsonBytes = values.Select(x => (byte[])x!);

        return jsonBytes;
    }

    public async Task<IEnumerable<byte[]>> GetFlagsAsync(IEnumerable<string> ids)
    {
        var keys = ids.Select(RedisKeys.FeatureFlag);

        var tasks = keys.Select(key => _redis.StringGetAsync(key));
        var values = await Task.WhenAll(tasks);
        return values.Select(x => (byte[])x!);
    }

    public async Task UpsertFlagAsync(JsonElement flag)
    {
        // upsert flag
        var cache = RedisCaches.Flag(flag);
        await _redis.StringSetAsync(cache.Key, cache.Value);

        // upsert index
        var index = RedisCaches.FlagIndex(flag);
        await _redis.SortedSetAddAsync(index.Key, index.Value, index.Score);
    }

    public async Task DeleteFlagAsync(Guid envId, Guid flagId)
    {
        // delete cache
        var cacheKey = RedisKeys.FeatureFlag(flagId);
        await _redis.KeyDeleteAsync(cacheKey);

        // delete index
        var index = RedisKeys.FlagIndex(envId);
        await _redis.SortedSetRemoveAsync(index, flagId.ToString());
    }

    public async Task<byte[]> GetSegmentAsync(string id)
    {
        var key = RedisKeys.Segment(id);
        var segment = await _redis.StringGetAsync(key);

        return (byte[])segment!;
    }

    public async Task<IEnumerable<byte[]>> GetSegmentsAsync(Guid envId, long timestamp)
    {
        // get segment keys
        var index = RedisKeys.SegmentIndex(envId);
        var ids = await _redis.SortedSetRangeByScoreAsync(index, timestamp, exclude: Exclude.Start);
        var keys = ids.Select(id => RedisKeys.Segment(id!));

        // get segments
        var tasks = keys.Select(key => _redis.StringGetAsync(key));
        var values = await Task.WhenAll(tasks);
        var jsonBytes = values.Select(x => (byte[])x!);

        return jsonBytes;
    }

    public async Task UpsertSegmentAsync(BsonDocument segment)
    {
        // upsert cache
        var cache = RedisCaches.Segment(segment);
        await _redis.StringSetAsync(cache.Key, cache.Value);

        // upsert index
        var index = RedisCaches.SegmentIndex(segment);
        await _redis.SortedSetAddAsync(index.Key, index.Value, index.Score);
    }

    public async Task UpsertSegmentAsync(JsonElement segment)
    {
        // upsert cache
        var cache = RedisCaches.Segment(segment);
        await _redis.StringSetAsync(cache.Key, cache.Value);

        // upsert index
        var index = RedisCaches.SegmentIndex(segment);
        await _redis.SortedSetAddAsync(index.Key, index.Value, index.Score);
    }

    public async Task DeleteSegmentAsync(Guid envId, Guid segmentId)
    {
        // delete cache
        var cacheKey = RedisKeys.Segment(segmentId);
        await _redis.KeyDeleteAsync(cacheKey);

        // delete index
        var index = RedisKeys.SegmentIndex(envId);
        await _redis.SortedSetRemoveAsync(index, segmentId.ToString());
    }
}
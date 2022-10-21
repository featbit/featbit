using Domain.FeatureFlags;
using Domain.Segments;
using StackExchange.Redis;

namespace Infrastructure.Caches;

public class RedisService : IRedisService
{
    private readonly IDatabase _redis;

    public RedisService(IConnectionMultiplexer multiplexer)
    {
        _redis = multiplexer.GetDatabase();
    }

    public async Task UpsertFlagAsync(FeatureFlag flag)
    {
        // upsert flag
        var cache = RedisCaches.Of(flag);
        await _redis.StringSetAsync(cache.Key, cache.Value);

        // upsert index
        var index = RedisCaches.IndexOf(flag);
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

    public async Task UpsertSegmentAsync(Segment segment)
    {
        // upsert cache
        var cache = RedisCaches.Of(segment);
        await _redis.StringSetAsync(cache.Key, cache.Value);

        // upsert index
        var index = RedisCaches.IndexOf(segment);
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
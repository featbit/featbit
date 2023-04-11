using Application.Caches;
using Domain.FeatureFlags;
using Domain.Segments;
using StackExchange.Redis;

namespace Infrastructure.Redis;

public class RedisCacheService : ICacheService
{
    private readonly IDatabase _database;

    public RedisCacheService(IRedisClient redis)
    {
        _database = redis.GetDatabase();
    }

    public async Task UpsertFlagAsync(FeatureFlag flag)
    {
        // upsert flag
        var cache = RedisCaches.Flag(flag);
        await _database.StringSetAsync(cache.Key, cache.Value);

        // upsert index
        var index = RedisCaches.FlagIndex(flag);
        await _database.SortedSetAddAsync(index.Key, index.Member, index.Score);
    }

    public async Task DeleteFlagAsync(Guid envId, Guid flagId)
    {
        // delete cache
        var cacheKey = RedisKeys.Flag(flagId);
        await _database.KeyDeleteAsync(cacheKey);

        // delete index
        var index = RedisKeys.FlagIndex(envId);
        await _database.SortedSetRemoveAsync(index, flagId.ToString());
    }

    public async Task UpsertSegmentAsync(Segment segment)
    {
        // upsert cache
        var cache = RedisCaches.Segment(segment);
        await _database.StringSetAsync(cache.Key, cache.Value);

        // upsert index
        var index = RedisCaches.SegmentIndex(segment);
        await _database.SortedSetAddAsync(index.Key, index.Member, index.Score);
    }
}
using Application.Caches;
using Domain.FeatureFlags;
using Domain.Organizations;
using Domain.Segments;
using MongoDB.Driver;
using StackExchange.Redis;

namespace Infrastructure.Redis;

public class RedisCacheService : ICacheService
{
    private readonly IDatabase _database;
    private readonly MongoDbClient _mongodb;

    public RedisCacheService(IRedisClient redis, MongoDbClient mongodb)
    {
        _database = redis.GetDatabase();
        _mongodb = mongodb;
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

    public async Task UpsertLicenseAsync(Organization organization)
    {
        var key = RedisKeys.License(organization.Id);
        var value = organization.License;

        await _database.StringSetAsync(key, value);
    }

    public async Task<string> GetLicenseAsync(Guid orgId)
    {
        var key = RedisKeys.License(orgId);
        if (await _database.KeyExistsAsync(key))
        {
            var value = await _database.StringGetAsync(key);
            return value.ToString();
        }

        // key not exist, get license from mongodb and cache it
        var license = await _mongodb.CollectionOf<Organization>()
            .Find(x => x.Id == orgId)
            .Project(y => y.License)
            .FirstOrDefaultAsync();

        var licenseCache = license ?? string.Empty;
        await _database.StringSetAsync(key, licenseCache);
        return licenseCache;
    }
}
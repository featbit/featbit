using Application.Caches;
using Domain.Environments;
using Domain.FeatureFlags;
using Domain.Segments;
using Domain.Workspaces;
using MongoDB.Driver;
using StackExchange.Redis;

namespace Infrastructure.Redis;

public class RedisCacheService : ICacheService
{
    private readonly IDatabase _redis;
    private readonly MongoDbClient _mongodb;

    public RedisCacheService(IRedisClient redis, MongoDbClient mongodb)
    {
        _redis = redis.GetDatabase();
        _mongodb = mongodb;
    }

    public async Task UpsertFlagAsync(FeatureFlag flag)
    {
        // upsert flag
        var cache = RedisCaches.Flag(flag);
        await _redis.StringSetAsync(cache.Key, cache.Value);

        // upsert index
        var index = RedisCaches.FlagIndex(flag);
        await _redis.SortedSetAddAsync(index.Key, index.Member, index.Score);
    }

    public async Task DeleteFlagAsync(Guid envId, Guid flagId)
    {
        // delete cache
        var cacheKey = RedisKeys.Flag(flagId);
        await _redis.KeyDeleteAsync(cacheKey);

        // delete index
        var index = RedisKeys.FlagIndex(envId);
        await _redis.SortedSetRemoveAsync(index, flagId.ToString());
    }

    public async Task UpsertSegmentAsync(Segment segment)
    {
        // upsert cache
        var cache = RedisCaches.Segment(segment);
        await _redis.StringSetAsync(cache.Key, cache.Value);

        // upsert index
        var index = RedisCaches.SegmentIndex(segment);
        await _redis.SortedSetAddAsync(index.Key, index.Member, index.Score);
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

    public async Task UpsertLicenseAsync(Workspace workspace)
    {
        var key = RedisKeys.License(workspace.Id);
        var value = workspace.License;

        await _redis.StringSetAsync(key, value);
    }

    public async Task UpsertSecretAsync(ResourceDescriptor resourceDescriptor, Secret secret)
    {
        var key = RedisKeys.Secret(secret.Value);

        var organization = resourceDescriptor.Organization;
        var project = resourceDescriptor.Project;
        var environment = resourceDescriptor.Environment;

        var fields = new HashEntry[]
        {
            new("type", secret.Type),
            new("organizationId", organization.Id.ToString()),
            new("organizationKey", organization.Key),
            new("projectId", project.Id.ToString()),
            new("projectKey", project.Key),
            new("envId", environment.Id.ToString()),
            new("envKey", environment.Key)
        };

        await _redis.HashSetAsync(key, fields);
    }

    public async Task DeleteSecretAsync(Secret secret)
    {
        var key = RedisKeys.Secret(secret.Value);

        await _redis.KeyDeleteAsync(key);
    }

    public async Task<string> GetLicenseAsync(Guid workspaceId)
    {
        var key = RedisKeys.License(workspaceId);
        if (await _redis.KeyExistsAsync(key))
        {
            var value = await _redis.StringGetAsync(key);
            return value.ToString();
        }

        // key not exist, get license from mongodb and cache it
        var license = await _mongodb.CollectionOf<Workspace>()
            .Find(x => x.Id == workspaceId)
            .Project(y => y.License)
            .FirstOrDefaultAsync();

        var licenseCache = license ?? string.Empty;
        await _redis.StringSetAsync(key, licenseCache);
        return licenseCache;
    }
}
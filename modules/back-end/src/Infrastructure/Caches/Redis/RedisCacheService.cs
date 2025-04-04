using Application.Caches;
using Domain.Environments;
using Domain.FeatureFlags;
using Domain.Segments;
using Domain.Workspaces;
using StackExchange.Redis;

namespace Infrastructure.Caches.Redis;

public class RedisCacheService(IRedisClient redis) : ICacheService
{
    private IDatabase Redis => redis.GetDatabase();

    public async Task UpsertFlagAsync(FeatureFlag flag)
    {
        // upsert flag
        var cache = RedisCaches.Flag(flag);
        await Redis.StringSetAsync(cache.Key, cache.Value);

        // upsert index
        var index = RedisCaches.FlagIndex(flag);
        await Redis.SortedSetAddAsync(index.Key, index.Member, index.Score);
    }

    public async Task DeleteFlagAsync(Guid envId, Guid flagId)
    {
        // delete cache
        var cacheKey = RedisKeys.Flag(flagId);
        await Redis.KeyDeleteAsync(cacheKey);

        // delete index
        var index = RedisKeys.FlagIndex(envId);
        await Redis.SortedSetRemoveAsync(index, flagId.ToString());
    }

    public async Task UpsertSegmentAsync(ICollection<Guid> envIds, Segment segment)
    {
        // upsert cache
        var cache = RedisCaches.Segment(segment);
        await Redis.StringSetAsync(cache.Key, cache.Value);

        // upsert index
        foreach (var envId in envIds)
        {
            var index = RedisCaches.SegmentIndex(envId, segment);
            await Redis.SortedSetAddAsync(index.Key, index.Member, index.Score);
        }
    }

    public async Task DeleteSegmentAsync(ICollection<Guid> envIds, Guid segmentId)
    {
        // delete cache
        var cacheKey = RedisKeys.Segment(segmentId);
        await Redis.KeyDeleteAsync(cacheKey);

        // delete index
        foreach (var envId in envIds)
        {
            var index = RedisKeys.SegmentIndex(envId);
            await Redis.SortedSetRemoveAsync(index, segmentId.ToString());
        }
    }

    public async Task UpsertLicenseAsync(Workspace workspace)
    {
        var key = RedisKeys.License(workspace.Id);
        var value = workspace.License;

        await Redis.StringSetAsync(key, value);
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

        await Redis.HashSetAsync(key, fields);
    }

    public async Task DeleteSecretAsync(Secret secret)
    {
        var key = RedisKeys.Secret(secret.Value);

        await Redis.KeyDeleteAsync(key);
    }

    public async Task<string> GetOrSetLicenseAsync(Guid workspaceId, Func<Task<string>> licenseGetter)
    {
        var key = RedisKeys.License(workspaceId);
        if (await Redis.KeyExistsAsync(key))
        {
            var value = await Redis.StringGetAsync(key);
            return value.ToString();
        }

        var license = await licenseGetter();
        await Redis.StringSetAsync(key, license);
        return license;
    }
}
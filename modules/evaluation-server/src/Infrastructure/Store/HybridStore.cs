using Domain.Shared;
using Infrastructure.MongoDb;
using Infrastructure.Redis;

namespace Infrastructure.Store;

public class HybridStore : IStore
{
    private readonly IStore[] _stores;

    public HybridStore(IRedisClient redisClient, IMongoDbClient mongodbClient)
    {
        var redis = new RedisStore(redisClient);
        var mongodb = new MongoDbStore(mongodbClient);

        _stores = new IStore[] { redis, mongodb };
    }

    public async ValueTask<bool> IsAvailableAsync()
    {
        foreach (var store in _stores)
        {
            if (await store.IsAvailableAsync())
            {
                return true;
            }
        }

        return false;
    }

    public async Task<IEnumerable<byte[]>> GetFlagsAsync(Guid envId, long timestamp)
    {
        foreach (var store in _stores)
        {
            var isStoreAvailable = await store.IsAvailableAsync();
            if (isStoreAvailable)
            {
                return await store.GetFlagsAsync(envId, timestamp);
            }
        }

        return Array.Empty<byte[]>();
    }

    public async Task<IEnumerable<byte[]>> GetFlagsAsync(IEnumerable<string> ids)
    {
        foreach (var store in _stores)
        {
            var isStoreAvailable = await store.IsAvailableAsync();
            if (isStoreAvailable)
            {
                return await store.GetFlagsAsync(ids);
            }
        }

        return Array.Empty<byte[]>();
    }

    public async Task<byte[]> GetSegmentAsync(string id)
    {
        foreach (var store in _stores)
        {
            var isStoreAvailable = await store.IsAvailableAsync();
            if (isStoreAvailable)
            {
                return await store.GetSegmentAsync(id);
            }
        }

        return Array.Empty<byte>();
    }

    public async Task<IEnumerable<byte[]>> GetSegmentsAsync(Guid envId, long timestamp)
    {
        foreach (var store in _stores)
        {
            var isStoreAvailable = await store.IsAvailableAsync();
            if (isStoreAvailable)
            {
                return await store.GetSegmentsAsync(envId, timestamp);
            }
        }

        return Array.Empty<byte[]>();
    }
}
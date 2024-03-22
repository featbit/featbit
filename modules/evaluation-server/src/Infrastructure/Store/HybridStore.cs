using Domain.Shared;
using Infrastructure.MongoDb;
using Infrastructure.Redis;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Store;

public class HybridStore : IStore
{
    public string Name => Stores.Hybrid;

    private readonly IStore _redis;
    private readonly IStore _mongodb;
    private readonly IStore _none = new NoneStore();

    private IStore AvailableStore { get; set; }
    private static StoreAvailabilityListener Listener => StoreAvailabilityListener.Instance;

    public HybridStore(IRedisClient redisClient, IMongoDbClient mongodbClient, ILogger<HybridStore> logger)
    {
        _redis = new RedisStore(redisClient);
        _mongodb = new MongoDbStore(mongodbClient);

        AvailableStore = GetAvailableStore(Listener.AvailableStore);

        // no need to unsubscribe from the event, as this store instance is singleton
        // see `StreamingBuilderExtensions.UseHybridStore` method for more details
        Listener.OnStoreAvailabilityChanged += (prev, current) =>
        {
            // log store availability change
            logger.LogWarning("Store availability changed from {prev} to {current}", prev, current);
            AvailableStore = GetAvailableStore(current);
        };

        return;

        IStore GetAvailableStore(string store)
        {
            return store switch
            {
                Stores.Redis => _redis,
                Stores.MongoDb => _mongodb,
                _ => _none
            };
        }
    }

    public Task<bool> IsAvailableAsync() => Task.FromResult(Listener.AvailableStore != Stores.None);

    public async Task<IEnumerable<byte[]>> GetFlagsAsync(Guid envId, long timestamp) =>
        await AvailableStore.GetFlagsAsync(envId, timestamp);

    public async Task<IEnumerable<byte[]>> GetFlagsAsync(IEnumerable<string> ids) =>
        await AvailableStore.GetFlagsAsync(ids);

    public async Task<byte[]> GetSegmentAsync(string id) =>
        await AvailableStore.GetSegmentAsync(id);

    public async Task<IEnumerable<byte[]>> GetSegmentsAsync(Guid envId, long timestamp) =>
        await AvailableStore.GetSegmentsAsync(envId, timestamp);

    public async Task<Secret?> GetSecretAsync(string secretString) =>
        await AvailableStore.GetSecretAsync(secretString);
}
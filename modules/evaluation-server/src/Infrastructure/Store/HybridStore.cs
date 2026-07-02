using Domain.Shared;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Store;

public class HybridStore : IStore
{
    public string Name => Stores.Hybrid;

    private readonly Dictionary<string, IDbStore> _dbStores;

    private IStore AvailableStore { get; set; }
    private static StoreAvailabilityListener Listener => StoreAvailabilityListener.Instance;

    public HybridStore(IEnumerable<IDbStore> dbStores, ILogger<HybridStore> logger)
    {
        _dbStores = dbStores.ToDictionary(x => x.Name, x => x);

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

        IStore GetAvailableStore(string store) =>
            _dbStores.TryGetValue(store, out var availableStore)
                ? availableStore
                : throw new ArgumentException($"Store {store} is not supported");
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
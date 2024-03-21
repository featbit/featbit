using Domain.Shared;
using Infrastructure.MongoDb;
using Infrastructure.Redis;
using Infrastructure.Utils;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Store;

public class StoreAvailableSentinel : IHostedService
{
    private readonly PeriodicTimer _periodicTimer = new(TimeSpan.FromSeconds(5));
    private readonly TimeSpan _checkTimeout = TimeSpan.FromSeconds(1);
    private readonly IStore[] _stores;
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<StoreAvailableSentinel> _logger;

    public StoreAvailableSentinel(
        IServiceProvider serviceProvider,
        IRedisClient redisClient,
        IMongoDbClient mongodbClient,
        ILogger<StoreAvailableSentinel> logger)
    {
        _serviceProvider = serviceProvider;

        var redisStore = new RedisStore(redisClient);
        var mongodbStore = new MongoDbStore(mongodbClient);
        _stores = new IStore[] { redisStore, mongodbStore };
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        // eager resolve HybirdStore
        _ = _serviceProvider.GetRequiredService<IStore>();

        // set initial store availability
        await SetAvailableStoreAsync(cancellationToken);

        // start checking store availability loop
        _ = StartCheckLoop(cancellationToken);
    }

    private async Task StartCheckLoop(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Start checking store availability loop.");

        while (await _periodicTimer.WaitForNextTickAsync(cancellationToken))
        {
            try
            {
                await SetAvailableStoreAsync(cancellationToken);
            }
            catch (OperationCanceledException)
            {
                // ignore
            }
            catch (Exception ex)
            {
                // log exception
                _logger.LogError(ex, "Error occurred while checking store availability");
            }
        }
    }

    private async Task SetAvailableStoreAsync(CancellationToken cancellationToken)
    {
        foreach (var store in _stores)
        {
            var workTask = store.IsAvailableAsync();
            var timeoutTask = Task.Delay(_checkTimeout, cancellationToken);

            var completedTask = await Task.WhenAny(workTask, timeoutTask);
            if (completedTask == workTask)
            {
                var isAvailable = await workTask;
                if (isAvailable)
                {
                    StoreAvailabilityListener.Instance.SetAvailable(store.Name);
                    return;
                }
            }
            else
            {
                workTask.Ignore();
            }
        }

        StoreAvailabilityListener.Instance.SetAvailable(Stores.None);
        _logger.LogError("No available store can be used.");
    }

    public Task StopAsync(CancellationToken cancellationToken)
    {
        _periodicTimer.Dispose();

        _logger.LogInformation("Store availability sentinel stopped.");

        return Task.CompletedTask;
    }
}
using Domain.Shared;
using Infrastructure.Utils;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Store;

public class StoreAvailableSentinel : IHostedService
{
    private readonly PeriodicTimer _periodicTimer = new(TimeSpan.FromSeconds(6));
    private readonly TimeSpan _checkAvailableTimeout = TimeSpan.FromSeconds(2);

    private readonly IServiceProvider _serviceProvider;
    private readonly IDbStore[] _dbStores;
    private readonly ILogger<StoreAvailableSentinel> _logger;

    public StoreAvailableSentinel(
        IServiceProvider serviceProvider,
        IEnumerable<IDbStore> dbStores,
        ILogger<StoreAvailableSentinel> logger)
    {
        _serviceProvider = serviceProvider;

        // order stores by name to ensure consistent store availability check order
        // see `Stores.cs` for more details
        _dbStores = dbStores.OrderBy(x => x.Name).ToArray();

        // we assume that the first store (the highest priority store) is available by default
        StoreAvailabilityListener.Instance.SetAvailable(_dbStores[0].Name);

        _logger = logger;
    }

    public Task StartAsync(CancellationToken cancellationToken)
    {
        // eager resolve HybridStore to attach **OnStoreAvailabilityChanged** event handler
        // see HybridStore constructor for more details
        _ = _serviceProvider.GetRequiredService<IStore>();

        // start checking store availability loop
        _ = StartCheckLoop(cancellationToken);

        _logger.LogInformation(
            "Store availability sentinel started. Default available store: {Store}.",
            StoreAvailabilityListener.Instance.AvailableStore
        );

        return Task.CompletedTask;
    }

    public async Task StartCheckLoop(CancellationToken cancellationToken)
    {
        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                await SetAvailableStoreAsync(_checkAvailableTimeout, cancellationToken);
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

            await _periodicTimer.WaitForNextTickAsync(cancellationToken);
        }
    }

    public async Task SetAvailableStoreAsync(TimeSpan timeout, CancellationToken cancellationToken)
    {
        foreach (var store in _dbStores)
        {
            var checkAvailableTask = store.IsAvailableAsync();
            var checkAvailableTimeoutTask = Task.Delay(timeout, cancellationToken);

            var completedTask = await Task.WhenAny(checkAvailableTask, checkAvailableTimeoutTask);
            if (completedTask == checkAvailableTask)
            {
                var isAvailable = await checkAvailableTask;
                if (isAvailable)
                {
                    StoreAvailabilityListener.Instance.SetAvailable(store.Name);
                    return;
                }
            }
            else
            {
                _logger.LogDebug("Store availability check timed out for {Store}.", store.Name);
                checkAvailableTask.Ignore();
            }
        }

        _logger.LogError("No available store can be used.");
    }

    public Task StopAsync(CancellationToken cancellationToken)
    {
        _periodicTimer.Dispose();

        _logger.LogInformation("Store availability sentinel stopped.");

        return Task.CompletedTask;
    }
}
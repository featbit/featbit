using System.Diagnostics;
using Domain.Observability;
using Domain.Shared;
using Infrastructure.Utils;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Store;

public partial class StoreAvailableSentinel : IHostedService
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

        // M4: failover was previously invisible — a successful switch was not logged at all, so a
        // pod silently serving from its fallback looked identical to a healthy one.
        StoreMetrics.Current.SetAvailableStoreProvider(
            () => StoreAvailabilityListener.Instance.AvailableStore);

        // The listener is a process-wide singleton and its event is never unsubscribed, so a
        // plain += would accumulate one handler per constructed sentinel and multiply the failover
        // count. Removing first makes the subscription idempotent.
        StoreAvailabilityListener.Instance.OnStoreAvailabilityChanged -= OnStoreAvailabilityChanged;
        StoreAvailabilityListener.Instance.OnStoreAvailabilityChanged += OnStoreAvailabilityChanged;

        _logger = logger;
    }

    private static void OnStoreAvailabilityChanged(string previous, string current)
        => StoreMetrics.Current.RecordFailover(current);

    public Task StartAsync(CancellationToken cancellationToken)
    {
        // eager resolve HybridStore to attach **OnStoreAvailabilityChanged** event handler
        // see HybridStore constructor for more details
        _ = _serviceProvider.GetRequiredService<IStore>();

        // start checking store availability loop
        _ = StartCheckLoop(cancellationToken);

        Log.SentinelStarted(_logger, StoreAvailabilityListener.Instance.AvailableStore);

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
                Log.AvailabilityCheckFailed(_logger, ex);
            }

            await _periodicTimer.WaitForNextTickAsync(cancellationToken);
        }
    }

    public async Task SetAvailableStoreAsync(TimeSpan timeout, CancellationToken cancellationToken)
    {
        foreach (var store in _dbStores)
        {
            var startedAt = Stopwatch.GetTimestamp();

            var checkAvailableTask = store.IsAvailableAsync();
            var checkAvailableTimeoutTask = Task.Delay(timeout, cancellationToken);

            var completedTask = await Task.WhenAny(checkAvailableTask, checkAvailableTimeoutTask);
            if (completedTask == checkAvailableTask)
            {
                var isAvailable = await checkAvailableTask;

                StoreMetrics.Current.RecordAvailabilityCheck(
                    store.Name,
                    isAvailable ? Outcomes.Success : Outcomes.Failure,
                    Stopwatch.GetElapsedTime(startedAt));

                if (isAvailable)
                {
                    StoreAvailabilityListener.Instance.SetAvailable(store.Name);
                    return;
                }
            }
            else
            {
                StoreMetrics.Current.RecordAvailabilityCheck(
                    store.Name, Outcomes.Timeout, Stopwatch.GetElapsedTime(startedAt));

                Log.AvailabilityCheckTimedOut(_logger, store.Name);
                checkAvailableTask.Ignore();
            }
        }

        StoreMetrics.Current.RecordNoStoreAvailable();

        Log.NoStoreAvailable(_logger);
    }

    public Task StopAsync(CancellationToken cancellationToken)
    {
        _periodicTimer.Dispose();

        Log.SentinelStopped(_logger);

        return Task.CompletedTask;
    }
}
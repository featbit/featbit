using System.Diagnostics;
using Domain.Shared;
using Infrastructure.Utils;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Infrastructure.Store;

/// <summary>
/// Checks every store in priority order on a fixed interval and tells the
/// <see cref="StoreAvailabilityListener"/>, which <see cref="HybridStore"/> routes reads by, which one to use.
/// </summary>
/// <remarks>
/// <para>
/// What a check finds goes through <see cref="StoreAvailabilityHysteresis"/>, so one failed or slow check
/// never moves reads: see <see cref="StoreAvailabilityOptions"/> for the thresholds and the minimum dwell.
/// The listener is never given <see cref="Stores.None"/>, which <see cref="HybridStore"/> cannot route to:
/// when no store answers, reads stay on the store they were on.
/// </para>
/// <para>
/// The checks run on a dedicated thread and wait for each store synchronously with their own budget, so the
/// budget is measured even when the thread pool is saturated. A store that misses the budget counts as timed
/// out only if a work item queued to the thread pool at the start of the check ran within half the budget.
/// Otherwise the pod was too busy to run the check's own continuations and the check is inconclusive: it
/// neither fails the store nor counts towards its recovery. Without that, a saturated pod would fail its own
/// Redis check and fall back to the slower database, which makes it busier still.
/// </para>
/// </remarks>
public sealed class StoreAvailableSentinel : IHostedService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly IDbStore[] _dbStores;
    private readonly StoreAvailabilityHysteresis _hysteresis;
    private readonly StoreAvailabilityListener _listener;
    private readonly TimeProvider _timeProvider;
    private readonly ILogger<StoreAvailableSentinel> _logger;
    private readonly Func<IThreadPoolProbe> _startThreadPoolProbe;
    private readonly TimeSpan _interval;
    private readonly TimeSpan _timeout;

    // not disposed: the check thread may still read its token after the host has disposed this service
    private readonly CancellationTokenSource _stopping = new();

    public StoreAvailableSentinel(
        IServiceProvider serviceProvider,
        IEnumerable<IDbStore> dbStores,
        IOptions<StoreAvailabilityOptions> options,
        ILogger<StoreAvailableSentinel> logger)
        : this(
            serviceProvider,
            dbStores,
            options.Value,
            StoreAvailabilityListener.Instance,
            TimeProvider.System,
            logger,
            ThreadPoolProbe.Start)
    {
    }

    internal StoreAvailableSentinel(
        IServiceProvider serviceProvider,
        IEnumerable<IDbStore> dbStores,
        StoreAvailabilityOptions options,
        StoreAvailabilityListener listener,
        TimeProvider timeProvider,
        ILogger<StoreAvailableSentinel> logger,
        Func<IThreadPoolProbe> startThreadPoolProbe)
    {
        _serviceProvider = serviceProvider;

        // order stores by name to ensure consistent store availability check order
        // see `Stores.cs` for more details
        _dbStores = dbStores.OrderBy(x => x.Name, StringComparer.Ordinal).ToArray();

        _listener = listener;
        _timeProvider = timeProvider;
        _logger = logger;
        _startThreadPoolProbe = startThreadPoolProbe;

        _hysteresis = new StoreAvailabilityHysteresis(
            _dbStores.Select(x => x.Name).ToArray(),
            options.FailureThreshold,
            options.RecoveryThreshold,
            TimeSpan.FromSeconds(options.MinimumDwellSeconds));
        _interval = TimeSpan.FromSeconds(options.CheckIntervalSeconds);
        _timeout = TimeSpan.FromMilliseconds(options.CheckTimeoutMilliseconds);

        // we assume that the first store (the highest priority store) is available by default
        _listener.SetAvailable(_hysteresis.Reported);
    }

    public Task StartAsync(CancellationToken cancellationToken)
    {
        // eager resolve HybridStore to attach **OnStoreAvailabilityChanged** event handler
        // see HybridStore constructor for more details
        _ = _serviceProvider.GetRequiredService<IStore>();

        var thread = new Thread(RunChecks)
        {
            IsBackground = true,
            Name = "Store availability sentinel"
        };
        thread.Start();

        _logger.LogInformation(
            "Store availability sentinel started. Default available store: {Store}.",
            _listener.AvailableStore
        );

        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken cancellationToken)
    {
        // the thread exits at its next wait; a check in flight is bounded by its own budget
        _stopping.Cancel();

        _logger.LogInformation("Store availability sentinel stopped.");

        return Task.CompletedTask;
    }

    private void RunChecks()
    {
        var stopping = _stopping.Token;

        while (!stopping.IsCancellationRequested)
        {
            var startedAt = Stopwatch.GetTimestamp();

            try
            {
                CheckOnce();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while checking store availability");
            }

            var untilNextCheck = _interval - Stopwatch.GetElapsedTime(startedAt);
            if (untilNextCheck > TimeSpan.Zero)
            {
                stopping.WaitHandle.WaitOne(untilNextCheck);
            }
        }
    }

    /// <summary>Checks the stores once and acts on what the check found.</summary>
    internal StoreAvailabilityDecision CheckOnce()
    {
        var observed = CheckStores();
        var decision = _hysteresis.Observe(observed, _timeProvider.GetUtcNow());

        switch (decision.Kind)
        {
            case StoreAvailabilityDecisionKind.Changed:
                // HybridStore logs the change when the listener raises it
                _listener.SetAvailable(decision.Reported);
                break;

            case StoreAvailabilityDecisionKind.NoStoreAvailable:
                _logger.LogError("No available store can be used.");
                break;

            case StoreAvailabilityDecisionKind.HeldByThreshold:
            case StoreAvailabilityDecisionKind.HeldByDwell:
                _logger.LogDebug(
                    "Store availability check found {ObservedStore}; still reporting {ReportedStore} ({Reason}).",
                    decision.Observed,
                    decision.Reported,
                    decision.Kind);
                break;
        }

        return decision;
    }

    /// <summary>
    /// The highest-priority store that answers, <see cref="Stores.None"/> if none does, or <c>null</c> if a
    /// store's check was inconclusive before any store answered.
    /// </summary>
    private string? CheckStores()
    {
        foreach (var store in _dbStores)
        {
            switch (Check(store))
            {
                case StoreCheckOutcome.Available:
                    return store.Name;

                case StoreCheckOutcome.Starved:
                    // the stores below it would be checked under the same starvation, and checking them
                    // would make this pod busier to learn nothing
                    return null;
            }
        }

        return Stores.None;
    }

    private StoreCheckOutcome Check(IDbStore store)
    {
        var threadPool = _startThreadPoolProbe();

        Task<bool> check;
        try
        {
            // run on the thread pool so the budget also covers any synchronous work before the check's
            // first await, such as the Redis client's first connect
            check = Task.Run(store.IsAvailableAsync);
            if (check.Wait(_timeout))
            {
                return check.Result ? StoreCheckOutcome.Available : StoreCheckOutcome.Unavailable;
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                ex is AggregateException { InnerExceptions: [var inner] } ? inner : ex,
                "Store availability check for {Store} failed.",
                store.Name);
            return StoreCheckOutcome.Unavailable;
        }

        check.Ignore();

        if (threadPool.RanWithin(_timeout / 2))
        {
            _logger.LogDebug("Store availability check timed out for {Store}.", store.Name);
            return StoreCheckOutcome.Unavailable;
        }

        _logger.LogWarning(
            "Store availability check for {Store} timed out while this pod's thread pool was saturated; ignoring it.",
            store.Name);
        return StoreCheckOutcome.Starved;
    }

    private enum StoreCheckOutcome
    {
        Available,
        Unavailable,
        Starved
    }
}

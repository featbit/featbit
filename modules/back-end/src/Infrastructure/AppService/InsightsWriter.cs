using Domain.Utils;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Infrastructure.AppService;

public class InsightsWriter : IDisposable
{
    // InsightsWriter is designed to be a singleton service that buffers insights and flushes them to the database in batches.

    private readonly PeriodicTimer _timer;
    private readonly Task _flushWorker;
    private readonly object _bufferLock = new();
    private readonly List<object> _insightsBuffer = [];

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<InsightsWriter> _logger;

    public InsightsWriter(IServiceScopeFactory scopeFactory, ILogger<InsightsWriter> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;

        _timer = new PeriodicTimer(TimeSpan.FromSeconds(1));
        _flushWorker = StartFlushLoopAsync();
    }

    public void Record(object insight)
    {
        lock (_bufferLock)
        {
            _insightsBuffer.Add(insight);
        }
    }

    private async Task StartFlushLoopAsync()
    {
        _logger.LogInformation("Start flushing insight loop...");

        while (await _timer.WaitForNextTickAsync())
        {
            try
            {
                await FlushCore();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Exception occurred while flushing insight events.");
            }
        }

        return;

        async Task FlushCore()
        {
            var stopwatch = ValueStopwatch.StartNew();

            // Get snapshots of the insights and clear the buffer.
            object[] snapshots;
            lock (_bufferLock)
            {
                snapshots = _insightsBuffer.ToArray();
                _insightsBuffer.Clear();
            }

            if (snapshots.Length == 0)
            {
                // If there are no insights in the buffer, wait for the next tick.
                return;
            }

            using var scope = _scopeFactory.CreateScope();
            var insightService = scope.ServiceProvider.GetRequiredService<IInsightService>();

            await insightService.AddManyAsync(snapshots);

            // Check log level here to avoid unnecessary memory allocation
            if (_logger.IsEnabled(LogLevel.Debug))
            {
                _logger.LogDebug(
                    "{Count} insight events has been handled in {ElapsedMilliseconds}ms.",
                    snapshots.Length,
                    stopwatch.GetElapsedTime().TotalMilliseconds
                );
            }
        }
    }

    public void Dispose()
    {
        // stop the timer
        _timer.Dispose();

        // wait 1 second to flush events
        _logger.LogInformation("Wait for 1 second to flush remaining insight events...");

        _flushWorker.Wait(TimeSpan.FromSeconds(1));
        _flushWorker.Dispose();

        _logger.LogInformation("Insights writer stopped...");

        GC.SuppressFinalize(this);
    }
}
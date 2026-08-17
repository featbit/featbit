using Application.Insights;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Infrastructure.AppService;

public sealed class InsightsFlushWorker(
    InsightsTracker tracker,
    IServiceScopeFactory scopeFactory,
    IOptions<InsightsTrackingOptions> options,
    ILogger<InsightsFlushWorker> logger)
    : BackgroundService
{
    private readonly TimeSpan _flushInterval = TimeSpan.FromMilliseconds(options.Value.FlushIntervalMs);
    private readonly int _maxBatchSize = options.Value.MaxBatchSize;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("Start flushing insight loop...");

        try
        {
            while (await tracker.Reader.WaitToReadAsync(stoppingToken))
            {
                var batch = await ReadBatchAsync(stoppingToken);
                if (batch.Length > 0)
                {
                    await PersistBatchAsync(batch);
                }
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // The host is stopping. The remaining insights are flushed below.
        }
        finally
        {
            await FlushRemainingAsync();
            logger.LogInformation("Insights flush worker stopped...");
        }
    }

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        tracker.Complete();

        if (ExecuteTask != null)
        {
            await ExecuteTask.WaitAsync(cancellationToken);
        }
    }

    private async Task<object[]> ReadBatchAsync(CancellationToken stoppingToken)
    {
        var batch = new List<object>(_maxBatchSize);
        DrainInto(batch);

        if (batch.Count == _maxBatchSize)
        {
            return batch.ToArray();
        }

        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
        timeout.CancelAfter(_flushInterval);

        while (batch.Count < _maxBatchSize)
        {
            try
            {
                if (!await tracker.Reader.WaitToReadAsync(timeout.Token))
                {
                    break;
                }
            }
            catch (OperationCanceledException) when (timeout.IsCancellationRequested)
            {
                break;
            }

            DrainInto(batch);
        }

        return batch.ToArray();
    }

    private async Task FlushRemainingAsync()
    {
        while (DrainBatch() is { Length: > 0 } batch)
        {
            await PersistBatchAsync(batch);
        }
    }

    private async Task PersistBatchAsync(object[] batch)
    {
        try
        {
            using var scope = scopeFactory.CreateScope();
            var insightService = scope.ServiceProvider.GetRequiredService<IInsightService>();

            await insightService.AddManyAsync(batch);

            if (logger.IsEnabled(LogLevel.Debug))
            {
                logger.LogDebug("{Count} insight events have been handled.", batch.Length);
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to flush {Count} insight events.", batch.Length);
        }
    }

    private object[] DrainBatch()
    {
        var batch = new List<object>(_maxBatchSize);
        DrainInto(batch);
        return batch.ToArray();
    }

    private void DrainInto(List<object> batch)
    {
        while (batch.Count < _maxBatchSize && tracker.Reader.TryRead(out var insight))
        {
            batch.Add(insight);
        }
    }
}

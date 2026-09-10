using System.Diagnostics;
using Application.Insights;
using Domain.Observability;
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

    private readonly WorkerObservability _observability = ServiceMeter.ForWorker(WorkerNames.InsightsFlush);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("Start flushing insight loop...");

        _observability.Started();

        try
        {
            while (await tracker.WaitToReadAsync(stoppingToken))
            {
                _observability.Heartbeat();

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
        catch (Exception ex)
        {
            // Counted, then rethrown: the host's existing handling of a failed BackgroundService is
            // deliberately left unchanged.
            _observability.LoopFailed(ex);
            throw;
        }
        finally
        {
            _observability.Stopped();
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
                if (!await tracker.WaitToReadAsync(timeout.Token))
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
        var start = Stopwatch.GetTimestamp();

        // T4 — the flush half of the insights pipeline. Tail-sampled on failure or slowness.
        using var trace = TailSampledTrace.Start(
            TraceCategories.Insights, "insights.flush", ActivityKind.Internal, SlowFlushThresholdMs);

        trace.SetTag("insights.batch_size", batch.Length);

        try
        {
            using var scope = scopeFactory.CreateScope();
            var insightService = scope.ServiceProvider.GetRequiredService<IInsightService>();

            await insightService.AddManyAsync(batch);

            _observability.Success();
            InsightsMetrics.Current.RecordFlush(
                Outcomes.Success, batch.Length, Stopwatch.GetElapsedTime(start));
            trace.Success();

            if (logger.IsEnabled(LogLevel.Debug))
            {
                logger.LogDebug("{Count} insight events have been handled.", batch.Length);
            }
        }
        catch (Exception ex)
        {
            _observability.LoopFailed(ex);

            // The batch is dropped here — the events are already out of the channel and are not
            // retried. Counting them is what turns "a flush failed" into "we lost N insights".
            InsightsMetrics.Current.RecordFlush(
                Outcomes.Failure, batch.Length, Stopwatch.GetElapsedTime(start));
            trace.Failed(ex);

            logger.LogError(ex, "Failed to flush {Count} insight events.", batch.Length);
        }
    }

    /// <summary>
    /// Duration at or above which an insights flush span is always retained. The flush interval is
    /// measured in milliseconds, so a batch taking five seconds means the analytics store is the
    /// bottleneck.
    /// </summary>
    private const double SlowFlushThresholdMs = 5_000d;

    private object[] DrainBatch()
    {
        var batch = new List<object>(_maxBatchSize);
        DrainInto(batch);
        return batch.ToArray();
    }

    private void DrainInto(List<object> batch)
    {
        while (batch.Count < _maxBatchSize && tracker.TryRead(out var insight))
        {
            batch.Add(insight);
        }
    }
}

using Application.Caches;
using Domain.Observability;
using Microsoft.Extensions.Options;

namespace Api.Application.ControlPlane;

public class PodHealthChecker(
    [FromKeyedServices("compositeCache")] ICacheService cacheService,
    ILogger<PodHealthChecker> logger,
    IOptionsMonitor<PodHealthOptions> options) : BackgroundService
{
    private readonly WorkerObservability _worker =
        ServiceMeter.ForWorker(ControlPlaneWorkerNames.PodHealthChecker);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        bool? lastEnabled = null;

        _worker.Started();

        try
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                var current = options.CurrentValue;

                _worker.Heartbeat();

                if (lastEnabled != current.Enabled)
                {
                    logger.LogInformation(
                        "PodHealthChecker is now {State}",
                        current.Enabled ? "enabled" : "disabled");
                    lastEnabled = current.Enabled;
                }

                if (current.Enabled)
                {
                    try
                    {
                        var deadPodTimeStamp = DateTimeOffset.UtcNow.AddSeconds(-current.TimeoutInSeconds);

                        var healthMessages = await cacheService.GetAllHealthMessages();

                        foreach (var healthMessage in healthMessages)
                        {
                            if (healthMessage.Timestamp >= deadPodTimeStamp)
                            {
                                continue;
                            }

                            if (!Guid.TryParse(healthMessage.PodId, out var podId))
                            {
                                // Counted as a failure, not a skip: this entry can never be evicted,
                                // so it accumulates in Redis forever. A flat line here is the only
                                // way to notice.
                                ControlPlaneMetrics.Current.RecordPodEviction(
                                    PodEvictionReasons.InvalidPodId, Outcomes.Failure);
                                logger.LogWarning(
                                    "Skipping unhealthy pod with invalid PodId {PodId} (last heartbeat at {Timestamp})",
                                    healthMessage.PodId, healthMessage.Timestamp);
                                continue;
                            }

                            logger.LogWarning(
                                "Pod {PodId} is considered unhealthy. Last heartbeat at {Timestamp}",
                                healthMessage.PodId, healthMessage.Timestamp);
                            await cacheService.DeletePodConnection(podId);
                            ControlPlaneMetrics.Current.RecordPodEviction(
                                PodEvictionReasons.HeartbeatTimeout, Outcomes.Success);
                        }

                        // The common healthy tick evicts nothing, so success here means "the sweep
                        // completed", not "a pod was evicted".
                        _worker.Success();
                    }
                    catch (OperationCanceledException)
                    {
                        throw;
                    }
                    catch (Exception ex)
                    {
                        _worker.LoopFailed(ex);
                        logger.LogError(ex, "Pod health check iteration failed; will retry next interval");
                    }
                }

                try
                {
                    await Task.Delay(TimeSpan.FromSeconds(current.CheckIntervalInSeconds), stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    // graceful shutdown
                }
            }
        }
        finally
        {
            _worker.Stopped();
        }
    }
}

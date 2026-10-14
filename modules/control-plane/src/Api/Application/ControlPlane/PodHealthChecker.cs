using Application.Caches;
using Domain.Observability;
using Microsoft.Extensions.Options;

namespace Api.Application.ControlPlane;

public partial class PodHealthChecker(
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
                    Log.EnabledStateChanged(logger, current.Enabled ? "enabled" : "disabled");
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
                                Log.InvalidPodId(logger, healthMessage.PodId, healthMessage.Timestamp);
                                continue;
                            }

                            Log.PodUnhealthy(logger, healthMessage.PodId, healthMessage.Timestamp);
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
                        Log.ErrorHealthCheckIteration(logger, ex);
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

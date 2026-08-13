using Application.Caches;
using Microsoft.Extensions.Options;

namespace Api.Application.ControlPlane;

public class PodHealthChecker(
    [FromKeyedServices("compositeCache")] ICacheService cacheService,
    ILogger<PodHealthChecker> logger,
    IOptionsMonitor<PodHealthOptions> options) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        bool? lastEnabled = null;

        while (!stoppingToken.IsCancellationRequested)
        {
            var current = options.CurrentValue;

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
                            logger.LogWarning(
                                "Skipping unhealthy pod with invalid PodId {PodId} (last heartbeat at {Timestamp})",
                                healthMessage.PodId, healthMessage.Timestamp);
                            continue;
                        }

                        logger.LogWarning(
                            "Pod {PodId} is considered unhealthy. Last heartbeat at {Timestamp}",
                            healthMessage.PodId, healthMessage.Timestamp);
                        await cacheService.DeletePodConnection(podId);
                    }
                }
                catch (OperationCanceledException)
                {
                    throw;
                }
                catch (Exception ex)
                {
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
}

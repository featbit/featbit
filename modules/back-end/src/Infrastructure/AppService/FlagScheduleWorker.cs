using Domain.AuditLogs;
using Domain.FlagSchedules;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Infrastructure.AppService;

public class FlagScheduleWorker(IServiceProvider serviceProvider, ILogger<FlagScheduleWorker> logger)
    : BackgroundService
{
    private readonly PeriodicTimer _timer = new(TimeSpan.FromSeconds(45));

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (await _timer.WaitForNextTickAsync(stoppingToken))
        {
            await DoWorkAsync(stoppingToken);
        }
    }

    public override Task StopAsync(CancellationToken cancellationToken)
    {
        logger.LogInformation("Stopping flag schedule worker...");

        // This will cause any active call to WaitForNextTickAsync() to return false immediately.
        _timer.Dispose();

        // This will cancel the stoppingToken and await ExecuteAsync(stoppingToken).
        return base.StopAsync(cancellationToken);
    }

    private async Task DoWorkAsync(CancellationToken cancellationToken)
    {
        using var scope = serviceProvider.CreateScope();
        var flagScheduleService = scope.ServiceProvider.GetRequiredService<IFlagScheduleService>();
        var featureFlagAppService = scope.ServiceProvider.GetRequiredService<IFeatureFlagAppService>();
        var flagChangeRequestService = scope.ServiceProvider.GetRequiredService<IFlagChangeRequestService>();

        try
        {
            var pendingSchedules = await flagScheduleService.FindManyAsync(
                x => x.Status == FlagScheduleStatus.PendingExecution && x.ScheduledTime <= DateTime.UtcNow
            );

            foreach (var schedule in pendingSchedules)
            {
                try
                {
                    await ApplyScheduleAsync(schedule);

                    logger.LogInformation(
                        "{ScheduleId}:{ScheduleTitle}: Flag schedule has been applied.", schedule.Id,
                        schedule.Title
                    );
                }
                catch (Exception ex)
                {
                    logger.LogError(ex,
                        "{ScheduleId}:{ScheduleTitle}: Error occurred while applying flag schedule.",
                        schedule.Id, schedule.Title
                    );
                }
            }
        }
        catch (OperationCanceledException)
        {
            // ignore operation has been canceled exception
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error occurred while processing flag schedule.");
        }

        return;

        async Task ApplyScheduleAsync(FlagSchedule schedule)
        {
            // apply flag draft
            await featureFlagAppService.ApplyDraftAsync(
                schedule.FlagDraftId, Operations.ApplyFlagSchedule, schedule.CreatorId
            );

            // update schedule status
            schedule.Applied(schedule.CreatorId);
            await flagScheduleService.UpdateAsync(schedule);

            // update change request status
            if (schedule.ChangeRequestId.HasValue)
            {
                var changeRequest = await flagChangeRequestService.GetAsync(schedule.ChangeRequestId.Value);
                changeRequest.Applied(schedule.CreatorId);
                await flagChangeRequestService.UpdateAsync(changeRequest);
            }
        }
    }
}
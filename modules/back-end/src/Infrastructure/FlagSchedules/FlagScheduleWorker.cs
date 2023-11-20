using Domain.AuditLogs;
using Domain.FlagSchedules;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Infrastructure.FlagSchedules;

public class FlagScheduleWorker : BackgroundService
{
    private readonly PeriodicTimer _timer = new(TimeSpan.FromSeconds(45));

    private readonly IFlagScheduleService _flagScheduleService;
    private readonly IFeatureFlagAppService _featureFlagAppService;
    private readonly IFlagChangeRequestService _flagChangeRequestService;
    private readonly ILogger<FlagScheduleWorker> _logger;

    public FlagScheduleWorker(
        IFlagScheduleService flagScheduleService,
        IFeatureFlagAppService featureFlagAppService,
        IFlagChangeRequestService flagChangeRequestService,
        ILogger<FlagScheduleWorker> logger)
    {
        _flagScheduleService = flagScheduleService;
        _featureFlagAppService = featureFlagAppService;
        _flagChangeRequestService = flagChangeRequestService;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (await _timer.WaitForNextTickAsync(stoppingToken) && !stoppingToken.IsCancellationRequested)
        {
            await DoWorkAsync(stoppingToken);
        }
    }

    public override Task StopAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Stopping flag schedule worker...");

        // This will cause any active call to WaitForNextTickAsync() to return false immediately.
        _timer.Dispose();

        // This will cancel the stoppingToken and await ExecuteAsync(stoppingToken).
        return base.StopAsync(cancellationToken);
    }

    private async Task DoWorkAsync(CancellationToken cancellationToken)
    {
        try
        {
            var pendingSchedules = await _flagScheduleService.FindManyAsync(
                x => x.Status == FlagScheduleStatus.PendingExecution && x.ScheduledTime <= DateTime.UtcNow
            );

            foreach (var schedule in pendingSchedules)
            {
                try
                {
                    await ApplyScheduleAsync(schedule);

                    _logger.LogInformation(
                        "{ScheduleId}:{ScheduleTitle}: Flag schedule has been applied.", schedule.Id,
                        schedule.Title
                    );
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex,
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
            _logger.LogError(ex, "Error occurred while processing flag schedule.");
        }

        return;

        async Task ApplyScheduleAsync(FlagSchedule schedule)
        {
            // apply flag draft
            await _featureFlagAppService.ApplyDraftAsync(
                schedule.FlagDraftId, Operations.ApplyFlagSchedule, schedule.CreatorId
            );

            // update schedule status
            schedule.Applied(schedule.CreatorId);
            await _flagScheduleService.UpdateAsync(schedule);

            // update change request status
            if (schedule.ChangeRequestId.HasValue)
            {
                var changeRequest = await _flagChangeRequestService.GetAsync(schedule.ChangeRequestId.Value);
                changeRequest.Applied(schedule.CreatorId);
                await _flagChangeRequestService.UpdateAsync(changeRequest);
            }
        }
    }
}
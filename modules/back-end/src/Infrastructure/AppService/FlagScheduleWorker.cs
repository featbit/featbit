using Domain.AuditLogs;
using Domain.FlagChangeRequests;
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

    internal async Task DoWorkAsync(CancellationToken cancellationToken)
    {
        using var scope = serviceProvider.CreateScope();
        var flagScheduleService = scope.ServiceProvider.GetRequiredService<IFlagScheduleService>();
        var featureFlagAppService = scope.ServiceProvider.GetRequiredService<IFeatureFlagAppService>();
        var flagChangeRequestService = scope.ServiceProvider.GetRequiredService<IFlagChangeRequestService>();
        var organizationService = scope.ServiceProvider.GetRequiredService<IOrganizationService>();

        try
        {
            var pendingSchedules = await flagScheduleService.FindManyAsync(
                x => (x.Status == FlagScheduleStatus.PendingExecution || x.Status == FlagScheduleStatus.PendingReview)
                     && x.ScheduledTime <= DateTime.UtcNow
            );

            foreach (var schedule in pendingSchedules)
            {
                try
                {
                    if (!await ApplyScheduleAsync(schedule)) continue;

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

        async Task<bool> ApplyScheduleAsync(FlagSchedule schedule)
        {
            FlagChangeRequest? changeRequest = null;
            if (schedule.ChangeRequestId.HasValue)
            {
                changeRequest = await flagChangeRequestService.GetAsync(schedule.ChangeRequestId.Value);
                if (changeRequest.OrgId != schedule.OrgId || changeRequest.EnvId != schedule.EnvId ||
                    changeRequest.FlagId != schedule.FlagId || changeRequest.FlagDraftId != schedule.FlagDraftId)
                    return false;

                // The durable decision is authoritative. Repair interrupted schedule updates,
                // and never execute an unreviewed or declined request even on a stale schedule.
                if (changeRequest.Status == FlagChangeRequestStatus.Declined)
                {
                    await flagScheduleService.TrySetReviewOutcomeAsync(schedule.Id, changeRequest.Id, false, schedule.CreatorId);
                    return false;
                }
                if (changeRequest.Status == FlagChangeRequestStatus.Applied)
                {
                    await flagScheduleService.TrySetReviewOutcomeAsync(schedule.Id, changeRequest.Id, true, schedule.CreatorId);
                    await flagScheduleService.TryMarkAppliedAsync(schedule.Id, schedule.CreatorId);
                    return false;
                }
                if (changeRequest.Status != FlagChangeRequestStatus.Approved) return false;
                if (schedule.Status == FlagScheduleStatus.PendingReview)
                {
                    if (!await flagScheduleService.TrySetReviewOutcomeAsync(schedule.Id, changeRequest.Id, true, schedule.CreatorId))
                        return false;
                    schedule.PendingExecution(schedule.CreatorId);
                }
            }

            if (schedule.Status != FlagScheduleStatus.PendingExecution) return false;
            // apply flag draft
            var organization = await organizationService.GetAsync(schedule.OrgId);
            await featureFlagAppService.ApplyDraftAsync(
                organization.WorkspaceId, organization.Id, schedule.FlagDraftId, Operations.ApplyFlagSchedule, schedule.CreatorId
            );

            // update schedule status
            await flagScheduleService.TryMarkAppliedAsync(schedule.Id, schedule.CreatorId);

            // update change request status
            if (changeRequest != null)
            {
                changeRequest.Applied(schedule.CreatorId);
                await flagChangeRequestService.UpdateAsync(changeRequest);
            }
            return true;
        }
    }
}

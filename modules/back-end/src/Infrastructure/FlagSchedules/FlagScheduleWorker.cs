using Application.FeatureFlags;
using Domain.Organizations;
using Domain.AuditLogs;
using Domain.FlagSchedules;
using MediatR;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Infrastructure.FlagSchedules;

public class FlagScheduleWorker : BackgroundService
{
    private readonly PeriodicTimer _timer = new(TimeSpan.FromSeconds(45));

    private readonly IFeatureFlagService _featureFlagService;
    private readonly IFlagScheduleService _flagScheduleService;
    private readonly IFlagDraftService _flagDraftService;
    private readonly ILicenseService _licenseService;
    private readonly ILogger<FlagScheduleWorker> _logger;
    private readonly IPublisher _publisher;

    public FlagScheduleWorker(
        IFeatureFlagService featureFlagService,
        IFlagScheduleService flagScheduleService,
        IFlagDraftService flagDraftService,
        ILicenseService licenseService,
        ILogger<FlagScheduleWorker> logger,
        IPublisher publisher)
    {
        _featureFlagService = featureFlagService;
        _flagScheduleService = flagScheduleService;
        _flagDraftService = flagDraftService;
        _licenseService = licenseService;
        _logger = logger;
        _publisher = publisher;
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
            var pendingSchedules =
                await _flagScheduleService.FindManyAsync(s => s.Status == FlagScheduleStatus.Pending && s.ScheduledTime <= DateTime.UtcNow);

            foreach (var schedule in pendingSchedules)
            {
                try
                {
                    var isScheduleGranted =
                        await _licenseService.IsFeatureGrantedAsync(schedule.OrgId, LicenseFeatures.Schedule);
                    if (!isScheduleGranted)
                    {
                        continue;
                    }

                    await ApplyScheduleAsync(schedule);
                    _logger.LogInformation("{ScheduleId}:{ScheduleTitle}: Flag schedule has been applied.", schedule.Id, schedule.Title);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "{ScheduleId}:{ScheduleTitle}: Error occurred while applying flag schedule.", schedule.Id, schedule.Title);
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
            var flagDraft = await _flagDraftService.FindOneAsync(x => x.Id == schedule.FlagDraftId);
            var instructions = flagDraft.GetInstructions();
            var flag = await _featureFlagService.GetAsync(flagDraft.FlagId);

            // apply flag instructions
            flag.ApplyInstructions(instructions, flagDraft.CreatorId);
            await _featureFlagService.UpdateAsync(flag);

            // set draft and schedule status
            flagDraft.Applied();
            schedule.Applied();
            await _flagDraftService.UpdateAsync(flagDraft);
            await _flagScheduleService.UpdateAsync(schedule);

            // publish on feature flag change notification
            var notification = new OnFeatureFlagChanged(
                flag, Operations.Update, flagDraft.DataChange, flagDraft.CreatorId, flagDraft.Comment
            );
            await _publisher.Publish(notification, cancellationToken);
        }
    }
}
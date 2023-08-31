using Application.FeatureFlags;
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
    private readonly IAuditLogService _auditLogService;
    private readonly IFlagDraftService _flagDraftService;
    private readonly ILogger<FlagScheduleWorker> _logger;
    private readonly IPublisher _publisher;

    public FlagScheduleWorker(
        IFeatureFlagService featureFlagService,
        IFlagScheduleService flagScheduleService,
        IAuditLogService auditLogService,
        IFlagDraftService flagDraftService,
        ILogger<FlagScheduleWorker> logger,
        IPublisher publisher)
    {
        _featureFlagService = featureFlagService;
        _flagScheduleService = flagScheduleService;
        _auditLogService = auditLogService;
        _flagDraftService = flagDraftService;
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

            // write audit log
            var auditLog = AuditLog.ForUpdate(flag, flagDraft.DataChange, flagDraft.Comment, flagDraft.CreatorId);
            await _auditLogService.AddOneAsync(auditLog);

            // publish on feature flag change notification
            await _publisher.Publish(new OnFeatureFlagChanged(flag, flagDraft.Comment), cancellationToken);
        }
    }
}
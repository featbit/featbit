using System.Text.Json;
using Application.FeatureFlags;
using Domain.AuditLogs;
using Domain.FeatureFlags;
using Domain.FlagDrafts;
using Domain.FlagSchedules;
using Domain.SemanticPatch;
using Domain.Utils;
using MediatR;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Infrastructure.FlagSchedules;

public class FlagScheduleWorker : BackgroundService
{
    private readonly IFeatureFlagService _featureFlagService;
    private readonly IFlagScheduleService _flagScheduleService;
    private readonly IAuditLogService _auditLogService;
    private readonly IFlagDraftService _flagDraftService;
    private readonly ILogger<FlagScheduleWorker> _logger;
    private readonly PeriodicTimer _timer = new(TimeSpan.FromSeconds(30));
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
            var pendingSchedules = await _flagScheduleService.FindManyAsync(s => s.Status == FlagScheduleStatus.WaitForExecution && s.ScheduledTime <= DateTime.UtcNow);

            foreach (var schedule in pendingSchedules)
            {
                var flagDraft = await _flagDraftService.FindOneAsync(x => x.Id == schedule.FlagDraftId);
                var previous = JsonSerializer.Deserialize<FeatureFlag>(flagDraft.DataChange.Previous,
                    ReusableJsonSerializerOptions.Web);
                var current = JsonSerializer.Deserialize<FeatureFlag>(flagDraft.DataChange.Current,
                    ReusableJsonSerializerOptions.Web);
                var instructions = FlagSemanticPatch.GetInstructions(previous, current);

                var flag = await _featureFlagService.GetAsync(current!.Id);

                try
                {
                    flag.ApplyPatches(instructions, flagDraft.CreatorId);
                    await _featureFlagService.UpdateAsync(flag);
                }
                catch (Exception e)
                {
                    _logger.LogError(e, "{ScheduleId}: Error occurred while performing flag scheduling.", schedule.Id);
                    continue;
                }

                // set status
                flagDraft.Status = FlagDraftStatus.Applied;
                flagDraft.UpdatedAt = DateTime.UtcNow;
                schedule.Status = FlagScheduleStatus.Executed;
                schedule.UpdatedAt = DateTime.UtcNow;
                await _flagDraftService.UpdateAsync(flagDraft);
                await _flagScheduleService.UpdateAsync(schedule);

                // write audit log
                var auditLog = AuditLog.ForUpdate(flag, flagDraft.DataChange, flagDraft.Comment, flagDraft.CreatorId);
                await _auditLogService.AddOneAsync(auditLog);

                // publish on feature flag change notification
                await _publisher.Publish(new OnFeatureFlagChanged(flag, flagDraft.Comment), cancellationToken);
            }
        }
        catch (OperationCanceledException)
        {
            // ignore operation has been canceled exception
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error occurred while performing flag scheduling.");
        }

        await Task.CompletedTask;
    }
}
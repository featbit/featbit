using System.Diagnostics;
using Domain.AuditLogs;
using Domain.FlagSchedules;
using Domain.Observability;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Infrastructure.AppService;

public class FlagScheduleWorker(IServiceProvider serviceProvider, ILogger<FlagScheduleWorker> logger)
    : BackgroundService
{
    private readonly PeriodicTimer _timer = new(TimeSpan.FromSeconds(45));

    /// <summary>
    /// Duration at or above which a schedule-apply span is always retained. Applying a draft is a
    /// handful of database writes, so ten seconds means something is badly wrong.
    /// </summary>
    private const double SlowApplyThresholdMs = 10_000d;

    private readonly WorkerObservability _observability = ServiceMeter.ForWorker(WorkerNames.FlagSchedule);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _observability.Started();

        try
        {
            while (await _timer.WaitForNextTickAsync(stoppingToken))
            {
                _observability.Heartbeat();
                await DoWorkAsync(stoppingToken);
            }
        }
        finally
        {
            _observability.Stopped();
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

            var metrics = ScheduleMetrics.Current;

            // The query result is already materialized, so this costs nothing and is the leading
            // indicator: a backlog that climbs across cycles means schedules are found but not applied.
            metrics.RecordDue(pendingSchedules.Count());

            foreach (var schedule in pendingSchedules)
            {
                var start = Stopwatch.GetTimestamp();

                // T5 — low-frequency background work. No schedule ID, title, or flag key on the
                // span: those are unbounded and already in the log statements below.
                using var trace = TailSampledTrace.Start(
                    TraceCategories.ScheduledWork,
                    "schedule.apply",
                    ActivityKind.Internal,
                    SlowApplyThresholdMs);

                try
                {
                    await ApplyScheduleAsync(schedule);

                    metrics.RecordApplied(Outcomes.Success, Stopwatch.GetElapsedTime(start));

                    // Lateness relative to what the customer asked for, which neither the apply
                    // duration nor the due count can express.
                    metrics.RecordLag(schedule.ScheduledTime, DateTime.UtcNow);

                    trace.Success();

                    logger.LogInformation(
                        "{ScheduleId}:{ScheduleTitle}: Flag schedule has been applied.", schedule.Id,
                        schedule.Title
                    );
                }
                catch (Exception ex)
                {
                    // Nothing retries this schedule, so a failure here is a customer-visible
                    // promise that will never be kept.
                    metrics.RecordApplied(Outcomes.Failure, Stopwatch.GetElapsedTime(start));
                    trace.Failed(ex);

                    logger.LogError(ex,
                        "{ScheduleId}:{ScheduleTitle}: Error occurred while applying flag schedule.",
                        schedule.Id, schedule.Title
                    );
                }
            }

            _observability.Success();
        }
        catch (OperationCanceledException)
        {
            // ignore operation has been canceled exception
        }
        catch (Exception ex)
        {
            _observability.LoopFailed(ex);
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
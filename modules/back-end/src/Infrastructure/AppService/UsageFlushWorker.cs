using Application.Usages;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Infrastructure.AppService;

public class UsageFlushWorker(
    UsageTracker usageTracker,
    IOptions<UsageTrackingOptions> options,
    IServiceProvider serviceProvider,
    ILogger<UsageFlushWorker> logger) : BackgroundService
{
    private readonly PeriodicTimer _timer = new(TimeSpan.FromMilliseconds(options.Value.FlushIntervalMs));

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (await _timer.WaitForNextTickAsync(stoppingToken))
        {
            var records = new List<UsageRecord>();

            try
            {
                // Drain everything currently available
                while (usageTracker.Reader.TryRead(out var record))
                {
                    records.Add(record);
                }

                if (records.Count == 0)
                {
                    continue;
                }

                await FlushCoreAsync(records);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                // ignore cancellation from the timer loop itself
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Exception occurred while flushing usage records.");
            }
        }
    }

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        _timer.Dispose();
        await base.StopAsync(cancellationToken);

        // Flush whatever remains in the channel
        var remaining = new List<UsageRecord>();
        while (usageTracker.Reader.TryRead(out var record))
        {
            remaining.Add(record);
        }

        if (remaining.Count > 0)
        {
            await FlushCoreAsync(remaining);
        }
    }

    private async Task FlushCoreAsync(List<UsageRecord> records)
    {
        var aggregatedRecords = UsageRecordsAggregator.Aggregate(records);

        using var scope = serviceProvider.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();

        if (aggregatedRecords.Length == 1)
        {
            // this is the most common case
            await workspaceService.SaveRecordsAsync(aggregatedRecords[0]);
        }
        else
        {
            var tasks = new Task[aggregatedRecords.Length];
            for (var i = 0; i < aggregatedRecords.Length; i++)
            {
                tasks[i] = workspaceService.SaveRecordsAsync(aggregatedRecords[i]);
            }

            await Task.WhenAll(tasks);
        }
    }
}
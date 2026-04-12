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
        var endUserRecords = new Dictionary<Guid, HashSet<string>>();
        var insightRecords = new Dictionary<Guid, (int flagEvals, int customMetrics)>();

        // aggregate records by envId, so we can batch upserts by envId
        foreach (var record in records)
        {
            switch (record)
            {
                case InsightsUsageRecord iur:
                    if (!endUserRecords.TryGetValue(iur.EnvId, out var endUsers))
                    {
                        endUsers = [];
                        endUserRecords[iur.EnvId] = endUsers;
                    }

                    // for end users, we only care about unique count
                    foreach (var endUser in iur.EndUsers)
                    {
                        endUsers.Add(endUser);
                    }

                    // for flag evaluations and custom metrics, we sum them up
                    var existing = insightRecords.GetValueOrDefault(iur.EnvId, (flagEvals: 0, customMetrics: 0));
                    insightRecords[iur.EnvId] = (
                        existing.flagEvals + iur.FlagEvaluations,
                        existing.customMetrics + iur.CustomMetrics
                    );

                    break;
            }
        }

        using var scope = serviceProvider.CreateScope();
        var usageAppService = scope.ServiceProvider.GetRequiredService<IUsageAppService>();
        await usageAppService.SaveRecordsAsync(endUserRecords, insightRecords);
    }
}
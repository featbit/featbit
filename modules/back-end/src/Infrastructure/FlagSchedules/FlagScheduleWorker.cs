using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Infrastructure.FlagSchedules;

public class FlagScheduleWorker : BackgroundService
{
    private readonly ILogger<FlagScheduleWorker> _logger;
    private readonly PeriodicTimer _timer = new(TimeSpan.FromSeconds(1));

    public FlagScheduleWorker(ILogger<FlagScheduleWorker> logger)
    {
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (await _timer.WaitForNextTickAsync(stoppingToken) && !stoppingToken.IsCancellationRequested)
        {
            try
            {
                _logger.LogInformation("Work work...");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while performing flag scheduling.");
            }
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
}
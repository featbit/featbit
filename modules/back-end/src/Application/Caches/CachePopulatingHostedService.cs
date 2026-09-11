using System.Diagnostics;
using Domain.Observability;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Application.Caches;

public partial class CachePopulatingHostedService : IHostedService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<CachePopulatingHostedService> _logger;

    public CachePopulatingHostedService(
        IServiceProvider serviceProvider,
        ILogger<CachePopulatingHostedService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        var start = Stopwatch.GetTimestamp();

        try
        {
            using var scope = _serviceProvider.CreateScope();
            var populatingService = scope.ServiceProvider.GetRequiredService<ICachePopulatingService>();
            await populatingService.PopulateAsync(cancellationToken);

            StartupMetrics.Current.RecordStage(
                StartupStages.CachePopulation, Outcomes.Success, Stopwatch.GetElapsedTime(start));
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            // The host is shutting down
            throw;
        }
        catch (Exception ex)
        {
            // Recorded before the rethrow: the host is about to fail to start, so this may be the
            // last chance to emit anything from this process.
            StartupMetrics.Current.RecordStage(
                StartupStages.CachePopulation, Outcomes.Failure, Stopwatch.GetElapsedTime(start));

            // Re-throw so the host fails to start and let the orchestrator (Kubernetes,
            // systemd, Docker, etc.) drive recovery via its restart policy.
            Log.ErrorPopulateCache(_logger, ex);
            throw;
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
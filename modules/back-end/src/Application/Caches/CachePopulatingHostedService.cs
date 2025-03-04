using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Application.Caches;

public class CachePopulatingHostedService : IHostedService
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
        try
        {
            using var scope = _serviceProvider.CreateScope();
            var populatingService = scope.ServiceProvider.GetRequiredService<ICachePopulatingService>();
            await populatingService.PopulateAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Exception occurred when populating cache.");
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
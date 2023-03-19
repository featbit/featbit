using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Caches;

public class CachePopulatingHostedService : IHostedService
{
    private readonly ICachePopulatingService _populatingService;
    private readonly ILogger<CachePopulatingHostedService> _logger;

    public CachePopulatingHostedService(
        ICachePopulatingService populatingService,
        ILogger<CachePopulatingHostedService> logger)
    {
        _populatingService = populatingService;
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        try
        {
            await _populatingService.PopulateAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Exception occurred when populating cache.");
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
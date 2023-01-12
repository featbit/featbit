using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Caches;

public class RedisPopulatingHostedService : IHostedService
{
    private readonly IPopulatingService _populatingService;
    private readonly ILogger<RedisPopulatingHostedService> _logger;

    public RedisPopulatingHostedService(
        IPopulatingService populatingService,
        ILogger<RedisPopulatingHostedService> logger)
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
            _logger.LogError(ex, "Exception occured when populating redis.");
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
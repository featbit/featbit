using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;

namespace Infrastructure.Caches;

public class RedisPopulatingHostedService : IHostedService
{
    private const string IsPopulatedKey = "redis-is-populated";
    private const string PopulateLockKey = "populate-redis";
    private static readonly string PopulateLockValue = Environment.MachineName;

    private readonly IDatabase _redis;
    private readonly IPopulatingService _populatingService;
    private readonly ILogger<RedisPopulatingHostedService> _logger;

    public RedisPopulatingHostedService(
        IPopulatingService populatingService,
        IConnectionMultiplexer multiplexer,
        ILogger<RedisPopulatingHostedService> logger)
    {
        _populatingService = populatingService;
        _logger = logger;
        _redis = multiplexer.GetDatabase();
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        var isPopulated = await _redis.StringGetAsync(IsPopulatedKey) == "true";
        if (isPopulated)
        {
            _logger.LogInformation("Redis has been populated before, ignore run again");
            return;
        }

        if (await _redis.LockTakeAsync(PopulateLockKey, PopulateLockValue, TimeSpan.FromSeconds(5)))
        {
            try
            {
                var success = await _populatingService.PopulateAsync();

                // mark redis as populated
                await _redis.StringSetAsync(IsPopulatedKey, success ? "true" : "false");
            }
            finally
            {
                await _redis.LockReleaseAsync(PopulateLockKey, PopulateLockValue);
            }
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
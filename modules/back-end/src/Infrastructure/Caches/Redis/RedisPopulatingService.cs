using System.Diagnostics;
using Application.Caches;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Caches.Redis;

public class RedisPopulatingService(
    IRedisClient redisClient,
    ICacheService cacheService,
    IFeatureFlagService flagService,
    ISegmentService segmentService,
    IEnvironmentService envService,
    ILogger<RedisPopulatingService> logger)
    : ICachePopulatingService
{
    private const string IsPopulatedKey = "featbit:redis-is-populated";
    private const string PopulateLockKey = "featbit:populate-redis";

    public async Task PopulateAsync()
    {
        var redis = redisClient.GetDatabase();

        var isPopulated = await redis.StringGetAsync(IsPopulatedKey) == "true";
        if (isPopulated)
        {
            logger.LogInformation("Redis has been populated before, ignore run again");
            return;
        }

        var lockValue = Guid.NewGuid().ToString();
        if (await redis.LockTakeAsync(PopulateLockKey, lockValue, TimeSpan.FromSeconds(5)))
        {
            logger.LogInformation("Start to populate redis.");
            var stopWatch = Stopwatch.StartNew();
            try
            {
                await PopulateFlagsAsync();
                await PopulateSegmentAsync();
                await PopulateSecretsAsync();

                // mark redis as populated
                await redis.StringSetAsync(IsPopulatedKey, "true");
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Exception occurred while populating redis");
            }
            finally
            {
                logger.LogInformation("Populate redis finished in {Elapsed} ms.", stopWatch.ElapsedMilliseconds);
                await redis.LockReleaseAsync(PopulateLockKey, lockValue);
            }
        }
    }

    private async Task PopulateFlagsAsync()
    {
        var flags = await flagService.FindManyAsync(_ => true);
        var tasks = flags.Select(flag => cacheService.UpsertFlagAsync(flag));

        await Task.WhenAll(tasks);

        logger.LogInformation("populate flag success, total count: {Total}", flags.Count);
    }

    private async Task PopulateSegmentAsync()
    {
        var caches = await segmentService.GetCachesAsync();
        var tasks = caches.Select(cache => cacheService.UpsertSegmentAsync(cache.EnvIds, cache.Segment));

        await Task.WhenAll(tasks);

        logger.LogInformation("populate segment success, total count: {Total}", caches.Count);
    }

    private async Task PopulateSecretsAsync()
    {
        var caches = await envService.GetSecretCachesAsync();
        var tasks = caches.Select(x => cacheService.UpsertSecretAsync(x.Descriptor, x.Secret));

        await Task.WhenAll(tasks);

        logger.LogInformation("populate secrets success, total count: {Total}", caches.Count);
    }
}
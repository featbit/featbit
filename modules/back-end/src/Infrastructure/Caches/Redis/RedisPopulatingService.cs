using System.Diagnostics;
using Application.Caches;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Infrastructure.Caches.Redis;

public partial class RedisPopulatingService(
    IRedisClient redisClient,
    ICacheService cacheService,
    IFeatureFlagService flagService,
    ISegmentService segmentService,
    IEnvironmentService envService,
    IOptions<RedisOptions> redisOptions,
    ILogger<RedisPopulatingService> logger)
    : ICachePopulatingService
{
    private const string IsPopulatedKey = "featbit:redis-is-populated";
    private const string PopulateLockKey = "featbit:populate-redis";

    public async Task PopulateAsync(CancellationToken stoppingToken)
    {
        Log.VerifyingPopulationStatus(logger);

        var lockTtl = TimeSpan.FromSeconds(redisOptions.Value.PopulateLockTtlSeconds);
        var maxWait = TimeSpan.FromSeconds(redisOptions.Value.PopulateMaxWaitSeconds);
        var pollInterval = TimeSpan.FromSeconds(2);
        var lockValue = Guid.NewGuid().ToString();

        var waitStopwatch = Stopwatch.StartNew();

        var redis = redisClient.GetDatabase();
        while (!stoppingToken.IsCancellationRequested)
        {
            if (await redis.StringGetAsync(IsPopulatedKey) == "true")
            {
                Log.AlreadyPopulated(logger);
                return;
            }

            if (await redis.LockTakeAsync(PopulateLockKey, lockValue, lockTtl))
            {
                try
                {
                    // Re-check the marker inside the lock. Closes the race where another
                    // instance finished writing the marker between our StringGet above and our
                    // LockTake. Without this we'd run a redundant populate immediately after
                    // the previous instance just completed one.
                    if (await redis.StringGetAsync(IsPopulatedKey) == "true")
                    {
                        Log.PopulatedByAnotherInstance(logger);
                        return;
                    }

                    Log.StartPopulate(logger, lockTtl.TotalSeconds);

                    var stopwatch = Stopwatch.StartNew();
                    await PopulateFlagsAsync();
                    await PopulateSegmentAsync();
                    await PopulateSecretsAsync();

                    // mark redis as populated
                    await redis.StringSetAsync(IsPopulatedKey, "true");

                    Log.PopulateFinished(logger, stopwatch.ElapsedMilliseconds);
                }
                finally
                {
                    await redis.LockReleaseAsync(PopulateLockKey, lockValue);
                }

                return;
            }

            // Another instance holds the lock. Wait and retry both the marker and the lock
            // take. Instances that arrive while a populate is in progress used to silently
            // no-op here and start serving against a partially-populated Redis. Looping
            // prevents that.
            if (waitStopwatch.Elapsed > maxWait)
            {
                throw new InvalidOperationException(
                    $"Timed out waiting for another instance to finish populating Redis " +
                    $"after {maxWait.TotalSeconds} seconds. This instance will not start. " +
                    $"Investigate whether the populating instance is stuck or crashed."
                );
            }

            Log.WaitingForAnotherInstance(logger, pollInterval.TotalSeconds, waitStopwatch.Elapsed.TotalSeconds);

            await Task.Delay(pollInterval, stoppingToken);
        }
    }

    private async Task PopulateFlagsAsync()
    {
        var flags = await flagService.FindManyAsync(_ => true);
        var tasks = flags.Select(flag => cacheService.UpsertFlagAsync(flag));

        await Task.WhenAll(tasks);

        Log.PopulateFlagSuccess(logger, flags.Count);
    }

    private async Task PopulateSegmentAsync()
    {
        var caches = await segmentService.GetCachesAsync();
        var tasks = caches.Select(cache => cacheService.UpsertSegmentAsync(cache.EnvIds, cache.Segment));

        await Task.WhenAll(tasks);

        Log.PopulateSegmentSuccess(logger, caches.Count);
    }

    private async Task PopulateSecretsAsync()
    {
        var caches = await envService.GetSecretCachesAsync();
        var tasks = caches.Select(x => cacheService.UpsertSecretAsync(x.Descriptor, x.Secret));

        await Task.WhenAll(tasks);

        Log.PopulateSecretsSuccess(logger, caches.Count);
    }
}
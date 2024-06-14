using System.Diagnostics;
using Application.Caches;
using Domain.FeatureFlags;
using Domain.Segments;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;
using StackExchange.Redis;
using Environment = Domain.Environments.Environment;

namespace Infrastructure.Redis;

public class RedisPopulatingService : ICachePopulatingService
{
    private const string IsPopulatedKey = "featbit:redis-is-populated";
    private const string PopulateLockKey = "featbit:populate-redis";

    private readonly IDatabase _redis;
    private readonly MongoDbClient _mongodb;
    private readonly ICacheService _cache;
    private readonly IEnvironmentService _envService;
    private readonly ILogger<RedisPopulatingService> _logger;

    public RedisPopulatingService(
        IRedisClient redis,
        MongoDbClient mongodb,
        ICacheService cache,
        IEnvironmentService envService,
        ILogger<RedisPopulatingService> logger)
    {
        _redis = redis.GetDatabase();
        _mongodb = mongodb;
        _cache = cache;
        _envService = envService;
        _logger = logger;
    }

    public async Task PopulateAsync()
    {
        var isPopulated = await _redis.StringGetAsync(IsPopulatedKey) == "true";
        if (isPopulated)
        {
            _logger.LogInformation("Redis has been populated before, ignore run again");
            return;
        }

        var lockValue = Guid.NewGuid().ToString();
        if (await _redis.LockTakeAsync(PopulateLockKey, lockValue, TimeSpan.FromSeconds(5)))
        {
            _logger.LogInformation("Start to populate redis.");
            var stopWatch = Stopwatch.StartNew();
            try
            {
                await PopulateFlagsAsync();
                await PopulateSegmentAsync();
                await PopulateSecretsAsync();

                // mark redis as populated
                await _redis.StringSetAsync(IsPopulatedKey, "true");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Exception occurred while populating redis");
            }
            finally
            {
                _logger.LogInformation("Populate redis finished in {Elapsed} ms.", stopWatch.ElapsedMilliseconds);
                await _redis.LockReleaseAsync(PopulateLockKey, lockValue);
            }
        }
    }

    public async Task PopulateFlagsAsync()
    {
        var flags = await _mongodb.QueryableOf<FeatureFlag>().ToListAsync();
        foreach (var flag in flags)
        {
            await _cache.UpsertFlagAsync(flag);
        }

        _logger.LogInformation("populate flag success, total count: {Total}", flags.Count);
    }

    private async Task PopulateSegmentAsync()
    {
        // populate segments
        var segments = await _mongodb.QueryableOf<Segment>().ToListAsync();
        foreach (var segment in segments)
        {
            await _cache.UpsertSegmentAsync(segment);
        }

        _logger.LogInformation("populate segment success, total count: {Total}", segments.Count);
    }

    private async Task PopulateSecretsAsync()
    {
        var envs = await _mongodb.QueryableOf<Environment>().ToListAsync();
        foreach (var env in envs)
        {
            var descriptor = await _envService.GetResourceDescriptorAsync(env.Id);
            if (descriptor == null)
            {
                _logger.LogWarning(
                    "Data inconsistency detected: Descriptor not found for environment with ID {EnvironmentId}. Please verify the integrity of the environment data in the database.",
                    env.Id
                );
                continue;
            }

            foreach (var secret in env.Secrets)
            {
                await _cache.UpsertSecretAsync(descriptor, secret);
            }
        }

        _logger.LogInformation("populate secrets success, total count: {Total}", envs.Sum(x => x.Secrets.Count));
    }
}
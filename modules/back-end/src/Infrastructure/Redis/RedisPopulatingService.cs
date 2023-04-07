using Application.Caches;
using Domain.FeatureFlags;
using Domain.Segments;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;
using StackExchange.Redis;

namespace Infrastructure.Redis;

public class RedisPopulatingService : ICachePopulatingService
{
    private const string IsPopulatedKey = "redis-is-populated";
    private const string PopulateLockKey = "populate-redis";
    private static readonly string PopulateLockValue = Environment.MachineName;

    private readonly IDatabase _redis;
    private readonly MongoDbClient _mongodb;
    private readonly ILogger<RedisPopulatingService> _logger;

    public RedisPopulatingService(
        IRedisClient redis,
        MongoDbClient mongodb,
        ILogger<RedisPopulatingService> logger)
    {
        _redis = redis.GetDatabase();
        _mongodb = mongodb;
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

        if (await _redis.LockTakeAsync(PopulateLockKey, PopulateLockValue, TimeSpan.FromSeconds(5)))
        {
            try
            {
                var flagPopulated = await PopulateFlagsAsync();
                var segmentPopulated = await PopulateSegmentAsync();

                // mark redis as populated
                await _redis.StringSetAsync(IsPopulatedKey, flagPopulated && segmentPopulated ? "true" : "false");
            }
            finally
            {
                await _redis.LockReleaseAsync(PopulateLockKey, PopulateLockValue);
            }
        }
    }

    public async Task<bool> PopulateFlagsAsync()
    {
        var success = false;

        var flags = await _mongodb.QueryableOf<FeatureFlag>().ToListAsync();
        var caches = flags.Select(RedisCaches.Flag).Select(x => _redis.StringSetAsync(x.Key, x.Value));

        var populateResults = await Task.WhenAll(caches);
        if (populateResults.Any(x => x == false))
        {
            _logger.LogError(
                "populate flag failed, failed count: {FailedCount}, success count: {SuccessCount}.",
                populateResults.Count(x => !x), populateResults.Count(x => x)
            );
        }
        else
        {
            _logger.LogInformation("populate flag success, total count: {Total}", populateResults.Length);
            success = true;
        }

        // populate flag indexes
        var indexCaches = flags
            .Select(RedisCaches.FlagIndex)
            .Select(index => _redis.SortedSetAddAsync(index.Key, index.Member, index.Score));
        var populateIndexResults = await Task.WhenAll(indexCaches);
        _logger.LogInformation(
            "populate flag index, added count: {Added}, score updated count: {Updated}",
            populateIndexResults.Count(x => x), populateIndexResults.Count(x => !x)
        );

        return success;
    }

    private async Task<bool> PopulateSegmentAsync()
    {
        var success = false;

        // populate segments
        var segments = await _mongodb.QueryableOf<Segment>().ToListAsync();
        var caches = segments.Select(RedisCaches.Segment).Select(x => _redis.StringSetAsync(x.Key, x.Value));

        var populateResults = await Task.WhenAll(caches);
        if (populateResults.Any(x => x == false))
        {
            _logger.LogError(
                "populate segment failed, failed count: {FailedCount}, success count: {SuccessCount}.",
                populateResults.Count(x => !x), populateResults.Count(x => x)
            );
        }
        else
        {
            _logger.LogInformation("populate segment success, total count: {Total}", populateResults.Length);
            success = true;
        }

        // populate segment indexes
        var indexCaches = segments
            .Select(RedisCaches.SegmentIndex)
            .Select(index => _redis.SortedSetAddAsync(index.Key, index.Member, index.Score));
        var populateIndexResults = await Task.WhenAll(indexCaches);
        _logger.LogInformation(
            "populate segment index, added count: {Added}, score updated count: {Updated}",
            populateIndexResults.Count(x => x), populateIndexResults.Count(x => !x)
        );

        return success;
    }
}
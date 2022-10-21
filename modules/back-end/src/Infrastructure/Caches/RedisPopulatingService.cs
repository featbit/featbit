using MongoDB.Driver;
using StackExchange.Redis;
using Microsoft.Extensions.Logging;
using Domain.Segments;
using Domain.FeatureFlags;

namespace Infrastructure.Caches;

public class RedisPopulatingService : IPopulatingService
{
    private readonly IDatabase _redis;
    private readonly MongoDbClient _mongoDb;
    private readonly ILogger<RedisPopulatingService> _logger;

    public RedisPopulatingService(
        IConnectionMultiplexer multiplexer,
        MongoDbClient mongoDb,
        ILogger<RedisPopulatingService> logger)
    {
        _redis = multiplexer.GetDatabase();
        _mongoDb = mongoDb;
        _logger = logger;
    }

    public async Task<bool> PopulateAsync()
    {
        var populateFlags = await PopulateFlagsAsync();
        var populateSegments = await PopulateSegmentAsync();

        return populateFlags && populateSegments;
    }

    public async Task<bool> PopulateFlagsAsync()
    {
        var success = false;

        var flags = await _mongoDb.QueryableOf<FeatureFlag>().ToListAsync();
        var caches = flags.Select(RedisCaches.Of).Select(x => _redis.StringSetAsync(x.Key, x.Value));

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
            .Select(RedisCaches.IndexOf)
            .Select(index => _redis.SortedSetAddAsync(index.Key, index.Value, index.Score));
        var populateIndexResults = await Task.WhenAll(indexCaches);
        _logger.LogInformation(
            "populate flag index, added count: {0}, score updated count: {1}",
            populateIndexResults.Count(x => x), populateIndexResults.Count(x => !x)
        );

        return success;
    }

    private async Task<bool> PopulateSegmentAsync()
    {
        var success = false;

        // populate segments
        var segments = await _mongoDb.QueryableOf<Segment>().ToListAsync();
        var caches = segments.Select(RedisCaches.Of).Select(x => _redis.StringSetAsync(x.Key, x.Value));

        var populateResults = await Task.WhenAll(caches);
        if (populateResults.Any(x => x == false))
        {
            _logger.LogError(
                "populate segment failed, failed count: {0}, success count: {1}.",
                populateResults.Count(x => !x), populateResults.Count(x => x)
            );
        }
        else
        {
            _logger.LogInformation("populate segment success, total count: {0}", populateResults.Length);
            success = true;
        }

        // populate segment indexes
        var indexCaches = segments
            .Select(RedisCaches.IndexOf)
            .Select(index => _redis.SortedSetAddAsync(index.Key, index.Value, index.Score));
        var populateIndexResults = await Task.WhenAll(indexCaches);
        _logger.LogInformation(
            "populate segment index, added count: {0}, score updated count: {1}",
            populateIndexResults.Count(x => x), populateIndexResults.Count(x => !x)
        );

        return success;
    }
}
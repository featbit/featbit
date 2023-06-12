using Domain.Shared;
using StackExchange.Redis;

namespace Infrastructure.Redis;

public class RedisStore : IStore
{
    private readonly IDatabase _redis;

    public RedisStore(RedisClient redisClient)
    {
        _redis = redisClient.GetDatabase();
    }

    public async Task<IEnumerable<byte[]>> GetFlagsAsync(Guid envId, long timestamp)
    {
        // get flag keys
        var index = RedisKeys.FlagIndex(envId);
        var ids = await _redis.SortedSetRangeByScoreAsync(index, timestamp, exclude: Exclude.Start);
        var keys = ids.Select(id => RedisKeys.Flag(id!));

        // get flags
        var tasks = keys.Select(key => _redis.StringGetAsync(key));
        var values = await Task.WhenAll(tasks);
        var jsonBytes = values.Select(x => (byte[])x!);

        return jsonBytes;
    }

    public async Task<IEnumerable<byte[]>> GetFlagsAsync(IEnumerable<string> ids)
    {
        var keys = ids.Select(RedisKeys.Flag);

        var tasks = keys.Select(key => _redis.StringGetAsync(key));
        var values = await Task.WhenAll(tasks);
        return values.Select(x => (byte[])x!);
    }

    public async Task<byte[]> GetSegmentAsync(string id)
    {
        var key = RedisKeys.Segment(id);
        var segment = await _redis.StringGetAsync(key);

        return (byte[])segment!;
    }

    public async Task<IEnumerable<byte[]>> GetSegmentsAsync(Guid envId, long timestamp)
    {
        // get segment keys
        var index = RedisKeys.SegmentIndex(envId);
        var ids = await _redis.SortedSetRangeByScoreAsync(index, timestamp, exclude: Exclude.Start);
        var keys = ids.Select(id => RedisKeys.Segment(id!));

        // get segments
        var tasks = keys.Select(key => _redis.StringGetAsync(key));
        var values = await Task.WhenAll(tasks);
        var jsonBytes = values.Select(x => (byte[])x!);

        return jsonBytes;
    }
}
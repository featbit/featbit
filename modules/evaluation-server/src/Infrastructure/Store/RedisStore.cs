using System.Text;
using Domain.Shared;
using Infrastructure.Caches.Redis;
using StackExchange.Redis;

namespace Infrastructure.Store;

public class RedisStore : IDbStore
{
    public string Name => Stores.Redis;

    private readonly IConnectionMultiplexer _multiplexer;
    private readonly IDatabase _redis;

    public RedisStore(IConnectionMultiplexer multiplexer)
    {
        _multiplexer = multiplexer;
        _redis = multiplexer.GetDatabase();
    }

    public async Task<bool> IsAvailableAsync()
    {
        // reference: https://github.com/Xabaril/AspNetCore.Diagnostics.HealthChecks/blob/master/src/HealthChecks.Redis/RedisHealthCheck.cs
        try
        {
            foreach (var endPoint in _multiplexer.GetEndPoints(configuredOnly: true))
            {
                var server = _multiplexer.GetServer(endPoint);
                if (server.ServerType != ServerType.Cluster)
                {
                    await _multiplexer.GetDatabase().PingAsync().ConfigureAwait(false);
                    await server.PingAsync().ConfigureAwait(false);
                }
                else
                {
                    var clusterInfo = await server.ExecuteAsync("CLUSTER", "INFO").ConfigureAwait(false);
                    if (clusterInfo is object && !clusterInfo.IsNull)
                    {
                        if (!clusterInfo.ToString().Contains("cluster_state:ok"))
                        {
                            // $"INFO CLUSTER is not on OK state for endpoint {endPoint}"
                            return false;
                        }
                    }
                    else
                    {
                        // $"INFO CLUSTER is null or can't be read for endpoint {endPoint}"
                        return false;
                    }
                }
            }

            return true;
        }
        catch
        {
            return false;
        }
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

        // for shared segments, replace empty envId with actual envId
        const string emptyEnvId = "\"envId\":\"\",";

        List<byte[]> jsonBytes = [];
        foreach (var value in values)
        {
            var strValue = (string)value!;
            if (strValue.Contains(emptyEnvId))
            {
                var newStrValue = strValue.Replace(emptyEnvId, $"\"envId\":\"{envId}\",");
                jsonBytes.Add(Encoding.UTF8.GetBytes(newStrValue));
            }
            else
            {
                jsonBytes.Add((byte[])value!);
            }
        }

        return jsonBytes;
    }

    public async Task<Secret?> GetSecretAsync(string secretString)
    {
        var key = RedisKeys.Secret(secretString);
        if (!await _redis.KeyExistsAsync(key))
        {
            return null;
        }

        var entries = await _redis.HashGetAsync(key, new RedisValue[] { "type", "projectKey", "envId", "envKey" });
        return new Secret(
            type: entries[0].ToString(),
            entries[1].ToString(),
            Guid.Parse(entries[2].ToString()),
            entries[3].ToString()
        );
    }
}
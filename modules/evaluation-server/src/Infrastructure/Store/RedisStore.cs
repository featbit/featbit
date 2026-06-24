using System.Text;
using Domain.Shared;
using Infrastructure.Caches.Redis;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;

namespace Infrastructure.Store;

public class RedisStore(IRedisClient redisClient, ILogger<RedisStore> logger) : IDbStore
{
    public string Name => Stores.Redis;

    private IDatabase Redis => redisClient.GetDatabase();

    public Task<bool> IsAvailableAsync() => redisClient.IsHealthyAsync();

    public async Task<IEnumerable<byte[]>> GetFlagsAsync(Guid envId, long timestamp)
    {
        // get flag keys
        var index = RedisKeys.FlagIndex(envId);
        var ids = await Redis.SortedSetRangeByScoreAsync(index, timestamp, exclude: Exclude.Start);
        var keys = ids.Select(id => RedisKeys.Flag(id!)).ToArray();

        // get flags
        var tasks = keys.Select(key => Redis.StringGetAsync(key));
        var values = await Task.WhenAll(tasks);

        return FilterOrphans(values, keys, envId, "flag");
    }

    public async Task<IEnumerable<byte[]>> GetFlagsAsync(IEnumerable<string> ids)
    {
        var keys = ids.Select(RedisKeys.Flag).ToArray();

        var tasks = keys.Select(key => Redis.StringGetAsync(key));
        var values = await Task.WhenAll(tasks);

        return FilterOrphans(values, keys, envId: null, "flag");
    }

    public async Task<byte[]> GetSegmentAsync(string id)
    {
        var key = RedisKeys.Segment(id);
        var segment = await Redis.StringGetAsync(key);

        return (byte[])segment!;
    }

    public async Task<IEnumerable<byte[]>> GetSegmentsAsync(Guid envId, long timestamp)
    {
        // get segment keys
        var index = RedisKeys.SegmentIndex(envId);
        var ids = await Redis.SortedSetRangeByScoreAsync(index, timestamp, exclude: Exclude.Start);
        var keys = ids.Select(id => RedisKeys.Segment(id!)).ToArray();

        // get segments
        var tasks = keys.Select(key => Redis.StringGetAsync(key));
        var values = await Task.WhenAll(tasks);

        // for shared segments, replace empty envId with actual envId
        const string emptyEnvId = "\"envId\":\"\",";

        var orphans = new List<string>();
        var jsonBytes = new List<byte[]>(values.Length);
        for (var i = 0; i < values.Length; i++)
        {
            // RedisValue.HasValue is false when the backing key is missing — i.e., the env's
            // segment-index references a value that no longer exists. Skip the orphan so the
            // downstream JSON parser doesn't blow up on a null byte[] / null string and abort
            // the entire env's data-sync for one bad index entry.
            // Likely causes: segment scope shrink (see bug #10) or a clear-then-repopulate
            // window leaving the index ahead of the value writes.
            if (!values[i].HasValue)
            {
                orphans.Add(keys[i]);
                continue;
            }

            var strValue = (string)values[i]!;
            if (strValue.Contains(emptyEnvId))
            {
                var newStrValue = strValue.Replace(emptyEnvId, $"\"envId\":\"{envId}\",");
                jsonBytes.Add(Encoding.UTF8.GetBytes(newStrValue));
            }
            else
            {
                jsonBytes.Add((byte[])values[i]!);
            }
        }

        LogOrphans(orphans, values.Length, envId, "segment");

        return jsonBytes;
    }

    public async Task<Secret?> GetSecretAsync(string secretString)
    {
        var key = RedisKeys.Secret(secretString);
        if (!await Redis.KeyExistsAsync(key))
        {
            return null;
        }

        var entries = await Redis.HashGetAsync(key, new RedisValue[] { "type", "projectKey", "envId", "envKey" });
        return new Secret(
            type: entries[0].ToString(),
            entries[1].ToString(),
            Guid.Parse(entries[2].ToString()),
            entries[3].ToString()
        );
    }

    // Filters out RedisValues whose backing key was missing (HasValue == false) and logs the
    // orphan keys so operators can spot accumulating drift between an env's index and its values.
    // Without this filter, a single orphan index member produces a null byte[] that crashes
    // JsonDocument.Parse downstream and aborts the entire env's data-sync (bug #4).
    private IEnumerable<byte[]> FilterOrphans(
        RedisValue[] values,
        RedisKey[] keys,
        Guid? envId,
        string entityName)
    {
        var orphans = new List<string>();
        var jsonBytes = new List<byte[]>(values.Length);
        for (var i = 0; i < values.Length; i++)
        {
            if (values[i].HasValue)
            {
                jsonBytes.Add((byte[])values[i]!);
            }
            else
            {
                orphans.Add(keys[i].ToString());
            }
        }

        LogOrphans(orphans, values.Length, envId, entityName);

        return jsonBytes;
    }

    private void LogOrphans(List<string> orphans, int totalCount, Guid? envId, string entityName)
    {
        if (orphans.Count == 0)
        {
            return;
        }

        if (envId.HasValue)
        {
            logger.LogWarning(
                "Orphan {EntityName} index members in env {EnvId}: {OrphanCount} of {TotalCount}. Missing keys: {MissingKeys}",
                entityName, envId.Value, orphans.Count, totalCount, string.Join(", ", orphans));
        }
        else
        {
            logger.LogWarning(
                "Orphan {EntityName} ids requested: {OrphanCount} of {TotalCount}. Missing keys: {MissingKeys}",
                entityName, orphans.Count, totalCount, string.Join(", ", orphans));
        }
    }
}
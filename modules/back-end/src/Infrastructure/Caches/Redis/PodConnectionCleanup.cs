using StackExchange.Redis;

namespace Infrastructure.Caches.Redis;

/// <summary>
/// Removes the connection keys that belong to one evaluation server pod, working through the keys in bounded
/// batches. Each batch is looked up and deleted before the next one is read, so the memory used is one batch,
/// not every <c>featbit:connection:*</c> key in Redis.
/// </summary>
internal static class PodConnectionCleanup
{
    public const int DefaultBatchSize = 500;

    /// <summary>
    /// Deletes every key in <paramref name="keys"/> whose heartbeat id is <paramref name="heartbeatId"/>.
    /// If a lookup or delete throws, the cleanup stops with that exception: the keys of earlier batches are
    /// already deleted and the keys not yet read are left alone.
    /// </summary>
    /// <param name="keys">The connection keys, streamed.</param>
    /// <param name="heartbeatId">The pod's heartbeat id.</param>
    /// <param name="readHeartbeatIds">Reads the heartbeat id of each key; one value per key, in order.</param>
    /// <param name="deleteKeys">Deletes the given keys.</param>
    /// <param name="batchSize">How many keys are looked up at once.</param>
    /// <returns>The number of keys deleted.</returns>
    public static async Task<int> RemoveOwnedByAsync(
        IAsyncEnumerable<RedisKey> keys,
        string heartbeatId,
        Func<RedisKey[], Task<RedisValue[]>> readHeartbeatIds,
        Func<RedisKey[], Task> deleteKeys,
        int batchSize = DefaultBatchSize)
    {
        ArgumentOutOfRangeException.ThrowIfLessThan(batchSize, 1);

        var removed = 0;
        var batch = new List<RedisKey>(batchSize);

        await foreach (var key in keys)
        {
            batch.Add(key);
            if (batch.Count < batchSize)
            {
                continue;
            }

            removed += await RemoveBatchAsync(batch, heartbeatId, readHeartbeatIds, deleteKeys);
            batch.Clear();
        }

        if (batch.Count > 0)
        {
            removed += await RemoveBatchAsync(batch, heartbeatId, readHeartbeatIds, deleteKeys);
        }

        return removed;
    }

    /// <summary>
    /// Looks up the heartbeat id of every key in one batch and deletes the keys the pod owns. Keys without a heartbeat id
    /// are left alone. Returns the number of keys deleted.
    /// </summary>
    private static async Task<int> RemoveBatchAsync(
        List<RedisKey> batch,
        string heartbeatId,
        Func<RedisKey[], Task<RedisValue[]>> readHeartbeatIds,
        Func<RedisKey[], Task> deleteKeys)
    {
        var batchKeys = batch.ToArray();
        var values = await readHeartbeatIds(batchKeys);

        var owned = batchKeys
            .Where((_, i) => values[i].HasValue && values[i] == heartbeatId)
            .ToArray();

        if (owned.Length > 0)
        {
            await deleteKeys(owned);
        }

        return owned.Length;
    }
}

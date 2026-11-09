using Infrastructure.Caches.Redis;
using StackExchange.Redis;

namespace Infrastructure.UnitTests.Caches.Redis;

public class PodConnectionCleanupTests
{
    private const string Pod = "pod-a";

    /// <summary>
    /// Streams the given keys one at a time, reporting each one as it is read so a test can see how far the cleanup has read.
    /// </summary>
    private static async IAsyncEnumerable<RedisKey> Stream(IEnumerable<string> keys, Action<string>? onRead = null)
    {
        foreach (var key in keys)
        {
            onRead?.Invoke(key);
            await Task.Yield();
            yield return (RedisKey)key;
        }
    }

    /// <summary>
    /// Answers a heartbeat-id lookup from a dictionary: the owner of each key, or no value for a key without one.
    /// </summary>
    private static Task<RedisValue[]> Owners(RedisKey[] keys, IReadOnlyDictionary<string, string> owner) =>
        Task.FromResult(keys
            .Select(k => owner.TryGetValue(k.ToString(), out var v) ? (RedisValue)v : RedisValue.Null)
            .ToArray());

    [Fact]
    public async Task RemoveOwnedByAsync_KeysWithMixedOwners_DeletesOnlyTheKeysTheHeartbeatIdOwns()
    {
        var owner = new Dictionary<string, string> { ["c1"] = Pod, ["c2"] = "pod-b", ["c3"] = Pod };
        var deleted = new List<string>();

        var removed = await PodConnectionCleanup.RemoveOwnedByAsync(
            Stream(["c1", "c2", "c3", "c4"]),
            Pod,
            keys => Owners(keys, owner),
            keys =>
            {
                deleted.AddRange(keys.Select(k => k.ToString()));
                return Task.CompletedTask;
            });

        Assert.Equal(2, removed);
        Assert.Equal(["c1", "c3"], deleted);
    }

    [Fact]
    public async Task RemoveOwnedByAsync_MoreKeysThanBatchSize_LooksUpOneBatchAtATimeAndDeletesBeforeReadingFurther()
    {
        const int total = 25;
        var keyNames = Enumerable.Range(0, total).Select(i => $"c{i}").ToArray();
        var owner = keyNames.ToDictionary(k => k, _ => Pod);
        var read = 0;
        var deletedSoFar = 0;
        var maxHeld = 0;
        var batchSizes = new List<int>();

        await PodConnectionCleanup.RemoveOwnedByAsync(
            Stream(keyNames, _ => read++),
            Pod,
            keys =>
            {
                batchSizes.Add(keys.Length);
                maxHeld = Math.Max(maxHeld, read - deletedSoFar);
                return Owners(keys, owner);
            },
            keys =>
            {
                deletedSoFar += keys.Length;
                return Task.CompletedTask;
            },
            batchSize: 10);

        Assert.Equal([10, 10, 5], batchSizes);
        Assert.Equal(10, maxHeld);
        Assert.Equal(total, deletedSoFar);
    }

    [Fact]
    public async Task RemoveOwnedByAsync_NoKeyInTheBatchIsOwned_SkipsTheDelete()
    {
        var deleteCalls = 0;

        var removed = await PodConnectionCleanup.RemoveOwnedByAsync(
            Stream(["c1", "c2"]),
            Pod,
            keys => Owners(keys, new Dictionary<string, string> { ["c1"] = "pod-b" }),
            _ =>
            {
                deleteCalls++;
                return Task.CompletedTask;
            });

        Assert.Equal(0, removed);
        Assert.Equal(0, deleteCalls);
    }

    /// <summary>
    /// A lookup that fails in the second batch stops the cleanup with that exception: the first batch stays deleted and the
    /// keys that were not read yet are not touched.
    /// </summary>
    [Fact]
    public async Task RemoveOwnedByAsync_LookupThrows_StopsWithTheExceptionAndLeavesUnreadKeysAlone()
    {
        var keyNames = Enumerable.Range(0, 30).Select(i => $"c{i}").ToArray();
        var owner = keyNames.ToDictionary(k => k, _ => Pod);
        var read = 0;
        var lookups = 0;
        var deleted = 0;

        var ex = await Assert.ThrowsAsync<TimeoutException>(() => PodConnectionCleanup.RemoveOwnedByAsync(
            Stream(keyNames, _ => read++),
            Pod,
            keys => ++lookups == 2 ? throw new TimeoutException("redis") : Owners(keys, owner),
            keys =>
            {
                deleted += keys.Length;
                return Task.CompletedTask;
            },
            batchSize: 10));

        Assert.Equal("redis", ex.Message);
        Assert.Equal(10, deleted);
        Assert.Equal(20, read);
    }

    [Fact]
    public async Task RemoveOwnedByAsync_NoKeys_DeletesNothing()
    {
        var removed = await PodConnectionCleanup.RemoveOwnedByAsync(
            Stream([]),
            Pod,
            _ => throw new InvalidOperationException("no lookup expected"),
            _ => throw new InvalidOperationException("no delete expected"));

        Assert.Equal(0, removed);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public async Task RemoveOwnedByAsync_BatchSizeBelowOne_Throws(int batchSize)
    {
        await Assert.ThrowsAsync<ArgumentOutOfRangeException>(() => PodConnectionCleanup.RemoveOwnedByAsync(
            Stream([]),
            Pod,
            _ => Task.FromResult(Array.Empty<RedisValue>()),
            _ => Task.CompletedTask,
            batchSize));
    }
}

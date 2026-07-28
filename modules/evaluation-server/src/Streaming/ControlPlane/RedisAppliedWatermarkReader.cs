using Infrastructure.Caches.Redis;
using StackExchange.Redis;
using Streaming.Connections;

namespace Streaming.ControlPlane;

/// <summary>
/// <see cref="IAppliedWatermarkReader"/> that derives the per-env applied watermark from the
/// local DC Redis flag and segment indexes. For each env it reads the single highest-scored
/// member of both <c>featbit:flag-index:{envId}</c> and <c>featbit:segment-index:{envId}</c>
/// (<c>ZREVRANGEBYSCORE ... LIMIT 0 1 WITHSCORES</c>) and reports the max of the two scores —
/// the latest committed flag or segment version this DC's Redis holds. The value is identical
/// for every pod in the DC and is correct immediately on a fresh pod, because it is read from
/// shared serving state rather than per-pod in-memory progress.
/// </summary>
public sealed class RedisAppliedWatermarkReader : IAppliedWatermarkReader
{
    /// <summary>
    /// Default TTL for the SCAN-fallback env-id cache (see <see cref="GetCachedScanEnvIds"/>).
    /// </summary>
    internal static readonly TimeSpan DefaultScanCacheTtl = TimeSpan.FromSeconds(45);

    private readonly IRedisClient _redisClient;
    private readonly IConnectionManager _connectionManager;
    private readonly TimeSpan _scanCacheTtl;
    private readonly Func<DateTimeOffset> _now;

    // Guards the SCAN-fallback cache below. ReadAsync is only ever driven by the single-threaded
    // HeartbeatService loop, but a lock keeps the cache correct even if that assumption changes
    // (e.g. a future on-demand health-check path calling ReadAsync concurrently).
    private readonly Lock _scanCacheLock = new();
    private HashSet<Guid>? _scanCacheEnvIds;
    private DateTimeOffset _scanCacheAt;

    public RedisAppliedWatermarkReader(IRedisClient redisClient, IConnectionManager connectionManager)
        : this(redisClient, connectionManager, DefaultScanCacheTtl, now: null)
    {
    }

    /// <summary>
    /// Testable constructor: <paramref name="scanCacheTtl"/> and <paramref name="now"/> let tests
    /// exercise the SCAN-fallback cache's expiry without sleeping.
    /// </summary>
    internal RedisAppliedWatermarkReader(
        IRedisClient redisClient,
        IConnectionManager connectionManager,
        TimeSpan scanCacheTtl,
        Func<DateTimeOffset>? now)
    {
        _redisClient = redisClient;
        _connectionManager = connectionManager;
        _scanCacheTtl = scanCacheTtl;
        _now = now ?? (() => DateTimeOffset.UtcNow);
    }

    public async Task<Dictionary<Guid, long>> ReadAsync(CancellationToken cancellationToken = default)
    {
        var db = _redisClient.GetDatabase();

        var envIds = EnumerateEnvIds();

        cancellationToken.ThrowIfCancellationRequested();

        // Fire every env's read unawaited so StackExchange.Redis pipelines all outstanding
        // commands over the shared multiplexer connection instead of paying N sequential RTTs
        // (the same Task.WhenAll convention RedisStore.ReadWithPointersAsync uses for its batched
        // GETs). At thousands of envs/pod, sequential reads could inflate the heartbeat period
        // toward the lease TTL and reopen the flap #99 fixed.
        var envTasks = envIds
            .Select(envId => (envId, task: ReadEnvWatermarkAsync(db, envId)))
            .ToList();

        await Task.WhenAll(envTasks.Select(t => t.task));

        var result = new Dictionary<Guid, long>();
        foreach (var (envId, task) in envTasks)
        {
            var watermark = task.Result;
            if (watermark.HasValue)
            {
                result[envId] = watermark.Value;
            }
        }

        return result;
    }

    /// <summary>
    /// Reads the max committed score across the env's flag index and segment index, or
    /// <c>null</c> when the env has no committed flags or segments. Uses a descending range
    /// limited to one member with scores, which maps to
    /// <c>ZREVRANGEBYSCORE key +inf -inf WITHSCORES LIMIT 0 1</c> against each index; the env is
    /// reported if either index is non-empty. The flag and segment reads are fired unawaited and
    /// joined via <see cref="Task.WhenAll(System.Threading.Tasks.Task[])"/> so they pipeline as a
    /// single round-trip pair instead of two sequential ones.
    /// </summary>
    private static async Task<long?> ReadEnvWatermarkAsync(IDatabase db, Guid envId)
    {
        var flagTask = ReadTopScoreAsync(db, RedisKeys.FlagIndex(envId));
        var segmentTask = ReadTopScoreAsync(db, RedisKeys.SegmentIndex(envId));

        await Task.WhenAll(flagTask, segmentTask);

        var flagTopScore = flagTask.Result;
        var segmentTopScore = segmentTask.Result;

        if (!flagTopScore.HasValue && !segmentTopScore.HasValue)
        {
            return null;
        }

        return Math.Max(flagTopScore ?? long.MinValue, segmentTopScore ?? long.MinValue);
    }

    /// <summary>
    /// Reads the single highest-scored member of a sorted-set index, or <c>null</c> if it is
    /// empty.
    /// </summary>
    private static async Task<long?> ReadTopScoreAsync(IDatabase db, RedisKey indexKey)
    {
        var entries = await db.SortedSetRangeByScoreWithScoresAsync(
            indexKey,
            order: Order.Descending,
            take: 1);

        if (entries.Length == 0)
        {
            return null;
        }

        // Scores are stored as the committed unix-ms timestamp; round to the nearest long.
        return (long)entries[0].Score;
    }

    /// <summary>
    /// Determines the set of envs to report. Primary source is the pod's active connections
    /// (cheap, in-memory). If the pod currently has no connections, falls back to the (cached)
    /// Redis flag-index/segment-index keyspace scan so a freshly started pod still reports the
    /// DC's serving state.
    /// </summary>
    private IReadOnlyCollection<Guid> EnumerateEnvIds()
    {
        var fromConnections = _connectionManager.GetAllConnections()
            .Select(c => c.EnvId)
            .ToHashSet();

        if (fromConnections.Count > 0)
        {
            return fromConnections;
        }

        return GetCachedScanEnvIds();
    }

    /// <summary>
    /// Returns the SCAN-derived env-id set, reusing a cached result for up to
    /// <see cref="_scanCacheTtl"/> (default <see cref="DefaultScanCacheTtl"/>, 45s). Without this
    /// cache, a standby/passive DC's pods — which have zero active connections and therefore hit
    /// this fallback on every heartbeat, forever (#104) — would run two full-keyspace SCAN passes
    /// every heartbeat interval (as often as every 5s) indefinitely.
    /// </summary>
    private HashSet<Guid> GetCachedScanEnvIds()
    {
        lock (_scanCacheLock)
        {
            var now = _now();
            if (_scanCacheEnvIds is not null && now - _scanCacheAt < _scanCacheTtl)
            {
                return _scanCacheEnvIds;
            }

            var scanned = ScanIndexEnvIds();
            _scanCacheEnvIds = scanned;
            _scanCacheAt = now;
            return scanned;
        }
    }

    /// <summary>
    /// Scans both <c>featbit:flag-index:*</c> and <c>featbit:segment-index:*</c> on every
    /// (non-replica) server and unions the env ids parsed out of the matching keys. SCAN is
    /// cursor-based and does not block Redis like KEYS.
    /// </summary>
    private HashSet<Guid> ScanIndexEnvIds()
    {
        var envIds = new HashSet<Guid>();
        var connection = _redisClient.Connection;

        foreach (var endpoint in connection.GetEndPoints())
        {
            var server = connection.GetServer(endpoint);
            if (server.IsReplica)
            {
                continue;
            }

            ScanIndexEnvIdsInto(envIds, server, RedisKeys.FlagIndexScanPattern, RedisKeys.TryParseFlagIndexEnvId);
            ScanIndexEnvIdsInto(envIds, server, RedisKeys.SegmentIndexScanPattern, RedisKeys.TryParseSegmentIndexEnvId);
        }

        return envIds;
    }

    /// <summary>
    /// Scans <paramref name="server"/> for keys matching <paramref name="scanPattern"/>, parses each
    /// matching key's env id via <paramref name="tryParseEnvId"/>, and adds every successfully parsed
    /// id into <paramref name="envIds"/>. Shared by both the flag-index and segment-index scans in
    /// <see cref="ScanIndexEnvIds"/> (#108 item 2), which are otherwise identical apart from the
    /// pattern/parser pair.
    /// </summary>
    private static void ScanIndexEnvIdsInto(
        HashSet<Guid> envIds,
        IServer server,
        string scanPattern,
        Func<string, Guid?> tryParseEnvId)
    {
        foreach (var key in server.Keys(pattern: scanPattern))
        {
            var envId = tryParseEnvId(key.ToString());
            if (envId.HasValue)
            {
                envIds.Add(envId.Value);
            }
        }
    }
}

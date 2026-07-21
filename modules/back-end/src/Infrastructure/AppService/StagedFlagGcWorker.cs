using System.Globalization;
using Application;
using Application.ControlPlane;
using Infrastructure.Caches.Redis;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;

namespace Infrastructure.AppService;

/// <summary>
/// Garbage-collects superseded, immutable versioned flag value keys written by the B1 stage/commit
/// storage (<c>featbit:flag:{id}:v{ts}</c>).
///
/// Periodically scans the versioned key-space via Redis <c>SCAN</c> (never <c>KEYS</c>), groups keys
/// by flag id, reads each flag's committed pointer (<c>featbit:flag-committed:{id}</c>), and deletes
/// only versions whose <c>ts</c> is strictly LESS THAN the committed <c>ts</c>. The currently
/// committed version, and any newer (staged-future) version with <c>ts &gt;= committed</c>, is never
/// deleted. A flag with no committed pointer is skipped entirely so unstaged/uncommitted versions
/// are left untouched.
///
/// The worker only runs under <see cref="ConsistencyMode.GatedCommit"/>; otherwise it no-ops.
/// </summary>
public sealed class StagedFlagGcWorker : BackgroundService
{
    /// <summary>
    /// Default interval between GC sweeps when not overridden via
    /// <c>ControlPlane:StagedFlagGc:IntervalSeconds</c>.
    /// </summary>
    public static readonly TimeSpan DefaultInterval = TimeSpan.FromMinutes(5);

    /// <summary>SCAN match pattern selecting only versioned flag value keys.</summary>
    private const string VersionedFlagKeyPattern = "featbit:flag:*:v*";

    private const string VersionSeparator = ":v";

    private readonly IRedisClient _redis;
    private readonly bool _enabled;
    private readonly TimeSpan _interval;
    private readonly ILogger<StagedFlagGcWorker> _logger;

    public StagedFlagGcWorker(
        IRedisClient redis,
        IConfiguration configuration,
        ILogger<StagedFlagGcWorker> logger)
    {
        _redis = redis;
        _logger = logger;
        _enabled = configuration.GetConsistencyMode() == ConsistencyMode.GatedCommit;

        var seconds = configuration.GetValue<int?>("ControlPlane:StagedFlagGc:IntervalSeconds");
        _interval = seconds is > 0
            ? TimeSpan.FromSeconds(seconds.Value)
            : DefaultInterval;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!_enabled)
        {
            _logger.LogInformation(
                "Staged flag GC worker disabled (consistency mode is not GatedCommit).");
            return;
        }

        using var timer = new PeriodicTimer(_interval);
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                var deleted = await RunGcOnceAsync(stoppingToken);
                if (deleted > 0)
                {
                    _logger.LogInformation(
                        "Staged flag GC swept {DeletedCount} superseded versioned flag key(s).",
                        deleted);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                // ignore cancellation from the timer loop itself
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while sweeping staged flag versions.");
            }
        }
    }

    /// <summary>
    /// Performs a single GC sweep over all versioned flag value keys and returns the number of keys
    /// deleted. Exposed so it can be invoked directly (e.g. by integration tests) without waiting on
    /// the periodic timer.
    ///
    /// For each flag: if it has no committed pointer the flag is skipped; otherwise every versioned
    /// key with <c>ts &lt; committed</c> is deleted. The committed version and any version with
    /// <c>ts &gt;= committed</c> are preserved.
    /// </summary>
    public async Task<int> RunGcOnceAsync(CancellationToken cancellationToken = default)
    {
        var db = _redis.GetDatabase();

        // Group versioned keys by flag id: id -> list of (key, ts).
        var byFlag = new Dictionary<Guid, List<(RedisKey Key, long Ts)>>();

        foreach (var endPoint in _redis.Connection.GetEndPoints())
        {
            cancellationToken.ThrowIfCancellationRequested();

            var server = _redis.Connection.GetServer(endPoint);
            if (server.IsReplica)
            {
                continue;
            }

            await foreach (var key in server.KeysAsync(pattern: VersionedFlagKeyPattern, pageSize: 250)
                               .WithCancellation(cancellationToken))
            {
                if (!TryParseVersionedKey(key, out var flagId, out var ts))
                {
                    continue;
                }

                if (!byFlag.TryGetValue(flagId, out var versions))
                {
                    versions = new List<(RedisKey, long)>();
                    byFlag[flagId] = versions;
                }

                versions.Add((key, ts));
            }
        }

        var toDelete = new List<RedisKey>();

        foreach (var (flagId, versions) in byFlag)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var pointerKey = RedisCaches.FlagCommittedPointer(flagId);
            var pointerValue = await db.StringGetAsync(pointerKey);

            // No committed pointer => never delete (unstaged/uncommitted versions are untouched).
            if (pointerValue.IsNullOrEmpty ||
                !long.TryParse((string?)pointerValue, NumberStyles.Integer, CultureInfo.InvariantCulture,
                    out var committedTs))
            {
                continue;
            }

            // Delete only versions strictly older than the committed version.
            foreach (var (key, ts) in versions)
            {
                if (ts < committedTs)
                {
                    toDelete.Add(key);
                }
            }
        }

        if (toDelete.Count == 0)
        {
            return 0;
        }

        await db.KeyDeleteAsync(toDelete.ToArray());
        return toDelete.Count;
    }

    /// <summary>
    /// Parses a versioned flag value key of the form <c>featbit:flag:{guid}:v{ts}</c>. The committed
    /// pointer key (<c>featbit:flag-committed:{id}</c>) and the bare value key
    /// (<c>featbit:flag:{id}</c>) do not match this shape and are rejected.
    /// </summary>
    private static bool TryParseVersionedKey(RedisKey key, out Guid flagId, out long ts)
    {
        flagId = default;
        ts = default;

        var s = key.ToString();
        const string prefix = "featbit:flag:";
        if (!s.StartsWith(prefix, StringComparison.Ordinal))
        {
            return false;
        }

        // remainder is "{guid}:v{ts}"
        var separatorIndex = s.LastIndexOf(VersionSeparator, StringComparison.Ordinal);
        if (separatorIndex <= prefix.Length)
        {
            return false;
        }

        var idPart = s.Substring(prefix.Length, separatorIndex - prefix.Length);
        var tsPart = s[(separatorIndex + VersionSeparator.Length)..];

        return Guid.TryParse(idPart, out flagId) &&
               long.TryParse(tsPart, NumberStyles.Integer, CultureInfo.InvariantCulture, out ts);
    }
}

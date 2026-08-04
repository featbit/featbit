using Application.Caches;
using Infrastructure;
using Infrastructure.Caches;
using Infrastructure.Caches.None;
using Infrastructure.Caches.Redis;
using Microsoft.Extensions.Logging;

namespace Api.Infrastructure.Caches;

public static class CacheServiceCollectionExtensions
{
    /// <summary>
    /// Default StackExchange.Redis <c>connectTimeout</c>/<c>syncTimeout</c> (ms) applied to every
    /// per-DC connection string (#92) when not already present and not overridden via
    /// <c>Redis:ConnectTimeoutMs</c> / <c>Redis:SyncTimeoutMs</c> (#108 item 8: moved under
    /// <c>Redis:*</c> to match the back-end/eval-server convention, #106 — the old
    /// <c>ControlPlane:Redis:*</c> keys are still read as a back-compat fallback, see
    /// <see cref="AddRedis"/> below).
    ///
    /// Trade-off: with <c>abortConnect=false</c> and NO explicit timeout, a command issued to a
    /// down/unreachable DC blocks for StackExchange.Redis's own default (~5s) before failing —
    /// and RecoveryWorker/CacheReconciler process every flag/segment/secret write for a DC
    /// SEQUENTIALLY within a tick, so that ~5s stall is incurred by EVERY write while the DC is down,
    /// accumulating linearly. 1500ms is deliberately generous relative to a healthy Redis's normal
    /// round-trip latency (to avoid false-positive command failures under real but slow load) while
    /// still bounding the worst case far below the unbounded default.
    /// </summary>
    internal const int DefaultRedisTimeoutMs = 1500;

    public static void AddCache(this IServiceCollection services, IConfiguration configuration)
    {
        var cacheProvider = configuration.GetCacheProvider();

        switch (cacheProvider)
        {
            case CacheProvider.None:
                AddNone();
                break;
            case CacheProvider.Redis:
                AddRedis();
                break;
        }

        return;

        void AddNone()
        {
            services.AddTransient<ICacheService, NoneCacheService>();
            // No DC connections without Redis; register an empty list so the cache reconciler
            // resolves and cleanly no-ops.
            services.AddSingleton<IReadOnlyList<DcRedisConnection>>(Array.Empty<DcRedisConnection>());
        }

        void AddRedis()
        {
            var redisInstances = configuration
                .GetSection("Redis:Instances")
                .Get<RedisInstanceConfig[]>() ?? [];

            // #92: explicit connect/sync timeouts, config-overridable, appended to every per-DC
            // connection string below (see DefaultRedisTimeoutMs for the trade-off rationale).
            // #108 item 8: primary key is Redis:* (matching the back-end/eval-server convention,
            // #106); the original ControlPlane:Redis:* key is still read as a back-compat fallback
            // so an existing deployment's config keeps working unchanged.
            var connectTimeoutMs =
                configuration.GetValue<int?>("Redis:ConnectTimeoutMs")
                ?? configuration.GetValue<int?>("ControlPlane:Redis:ConnectTimeoutMs")
                ?? DefaultRedisTimeoutMs;
            var syncTimeoutMs =
                configuration.GetValue<int?>("Redis:SyncTimeoutMs")
                ?? configuration.GetValue<int?>("ControlPlane:Redis:SyncTimeoutMs")
                ?? DefaultRedisTimeoutMs;

            var clients = redisInstances
                .Select(instance =>
                {
                    var connStr = instance.ConnectionString;
                    if (!string.IsNullOrEmpty(instance.Password))
                        connStr += $",password={instance.Password}";
                    // Make the multiplexer self-healing. Without abortConnect=false, a peer that is
                    // unreachable at first touch makes ConnectionMultiplexer.Connect throw, and the
                    // Lazy<ConnectionMultiplexer> in RedisClient caches that exception PERMANENTLY —
                    // every later write to that DC re-throws and the cache can never self-correct.
                    // With abortConnect=false, Connect returns immediately and reconnects in the
                    // background, so a returned peer accepts the backfill that repairs its cache.
                    if (!connStr.Contains("abortConnect", StringComparison.OrdinalIgnoreCase))
                        connStr += ",abortConnect=false";
                    connStr = AppendRedisTimeouts(connStr, connectTimeoutMs, syncTimeoutMs);
                    return new RedisClient(connStr);
                })
                .ToList();

            services.AddSingleton<IRedisClient>(clients[0]);

            // An empty DcId falls back to the ordinal index so a misconfiguration does not crash
            // startup (a warning is logged below when building the composite).
            string ResolveDcId(int index)
            {
                var dcId = redisInstances[index].DcId;
                return string.IsNullOrWhiteSpace(dcId) ? index.ToString() : dcId;
            }

            // All DC connections (index 0 is the local DC by convention; the rest are peers). The
            // cache reconciler polls each for connection state and backfills that DC from the source
            // of truth when its link becomes reachable (startup or reconnect) — the LOCAL entry is
            // what lets a cluster self-heal its own cache even when the peer is down. Reuses the SAME
            // RedisClient instances the composite writes through.
            var dcConnections = clients
                .Select((client, index) => new DcRedisConnection(ResolveDcId(index), client, index == 0))
                .ToList();
            services.AddSingleton<IReadOnlyList<DcRedisConnection>>(dcConnections);

            // Pair each cache service with its instance's DcId so broadcast results
            // can be keyed by DC. The first instance remains the local DC by convention.
            var dcCacheServices = clients
                .Select((client, index) => new DcCacheService(ResolveDcId(index), new RedisCacheService(client)))
                .ToList();

            services.AddTransient<ICacheService, RedisCacheService>();

            services.AddKeyedSingleton<ICacheService>(
                "compositeCache",
                (sp, _) =>
                {
                    var logger = sp.GetRequiredService<ILogger<CompositeRedisCacheService>>();

                    for (var i = 0; i < redisInstances.Length; i++)
                    {
                        if (string.IsNullOrWhiteSpace(redisInstances[i].DcId))
                        {
                            logger.LogWarning(
                                "Redis:Instances[{Index}] has no DcId configured; " +
                                "falling back to ordinal index '{Index}' as the DC key. " +
                                "Configure a DcId per instance for stable per-DC broadcast results.",
                                i,
                                i);
                        }
                    }

                    return new CompositeRedisCacheService(dcCacheServices, logger);
                });
        }
    }

    /// <summary>
    /// Appends explicit <c>connectTimeout</c>/<c>syncTimeout</c> StackExchange.Redis options (#92) to
    /// <paramref name="connectionString"/>, skipping whichever one is ALREADY specified (case-
    /// insensitive token match) so an operator's explicit per-instance override always wins. Safe for
    /// Sentinel-style / multi-host connection strings (comma-separated host list followed by
    /// <c>key=value</c> options) since StackExchange.Redis recognizes an option token anywhere after
    /// the first endpoint — appending at the very end (as this method, and the existing
    /// <c>abortConnect</c> append above, both do) is always valid regardless of how many hosts precede
    /// it. Internal + <c>InternalsVisibleTo</c> so the connection-string shape can be unit tested
    /// without a real Redis.
    /// </summary>
    internal static string AppendRedisTimeouts(string connectionString, int connectTimeoutMs, int syncTimeoutMs)
    {
        var result = connectionString;

        if (!HasOption(result, "connectTimeout"))
        {
            result += $",connectTimeout={connectTimeoutMs}";
        }

        if (!HasOption(result, "syncTimeout"))
        {
            result += $",syncTimeout={syncTimeoutMs}";
        }

        return result;

        static bool HasOption(string connStr, string optionName) =>
            connStr
                .Split(',')
                .Any(token => token.TrimStart().StartsWith(optionName + "=", StringComparison.OrdinalIgnoreCase));
    }
}
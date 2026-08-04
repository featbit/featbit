using Microsoft.Extensions.Configuration;
using StackExchange.Redis;

namespace Infrastructure.Caches.Redis;

public class RedisClient : IRedisClient
{
    /// <summary>
    /// Default StackExchange.Redis <c>connectTimeout</c>/<c>syncTimeout</c> (ms) applied by
    /// <see cref="EnsureSelfHealingOptions"/> (#106) when neither option is already present in the
    /// connection string, and not overridden via <c>Redis:ConnectTimeoutMs</c> /
    /// <c>Redis:SyncTimeoutMs</c>. Mirrors the control-plane default
    /// (<c>CacheServiceCollectionExtensions.DefaultRedisTimeoutMs</c>, #92): 1500ms bounds
    /// StackExchange.Redis's own (much longer) default wait for an unreachable/down Redis, without
    /// being so tight that normal load trips false-positive command failures.
    /// </summary>
    internal const int DefaultRedisTimeoutMs = 1500;

    private readonly Lazy<ConnectionMultiplexer> _lazyConnection;

    public IConnectionMultiplexer Connection => _lazyConnection.Value;

    public RedisClient(IConfiguration configuration)
    {
        var connectionString = configuration.GetRedisConnectionString();

        var connectTimeoutMs =
            configuration.GetValue<int?>("Redis:ConnectTimeoutMs") ?? DefaultRedisTimeoutMs;
        var syncTimeoutMs =
            configuration.GetValue<int?>("Redis:SyncTimeoutMs") ?? DefaultRedisTimeoutMs;

        connectionString = EnsureSelfHealingOptions(connectionString, connectTimeoutMs, syncTimeoutMs);

        _lazyConnection = new Lazy<ConnectionMultiplexer>(
            () => ConnectionMultiplexer.Connect(connectionString)
        );
    }

    /// <summary>
    /// #106: makes the multiplexer self-healing. Without <c>abortConnect=false</c>, Redis being
    /// unreachable at first touch (common during rolling deploys) makes
    /// <c>ConnectionMultiplexer.Connect</c> throw, and the <see cref="Lazy{ConnectionMultiplexer}"/>
    /// above caches that exception PERMANENTLY — every later access re-throws until the pod
    /// restarts, even after Redis recovers. With <c>abortConnect=false</c>, <c>Connect</c> returns
    /// immediately and reconnects in the background instead. Also appends explicit
    /// <c>connectTimeout</c>/<c>syncTimeout</c> so a command issued while disconnected fails fast
    /// instead of waiting StackExchange.Redis's own (much longer) default. Ported from the
    /// control-plane template (<c>CacheServiceCollectionExtensions.AppendRedisTimeouts</c>, #92) —
    /// only appends an option when the operator hasn't already specified it (case-insensitive token
    /// match), so an explicit override always wins. Safe for Sentinel-style / multi-host connection
    /// strings since StackExchange.Redis recognizes an option token anywhere after the first
    /// endpoint. Internal + <c>InternalsVisibleTo</c> so this is unit-testable without a real Redis.
    /// </summary>
    internal static string EnsureSelfHealingOptions(string connectionString, int connectTimeoutMs, int syncTimeoutMs)
    {
        var result = connectionString;

        if (!HasOption(result, "abortConnect"))
        {
            result += ",abortConnect=false";
        }

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

    // ReSharper disable once CognitiveComplexity
    public async Task<bool> IsHealthyAsync()
    {
        // reference: https://github.com/Xabaril/AspNetCore.Diagnostics.HealthChecks/blob/master/src/HealthChecks.Redis/RedisHealthCheck.cs
        try
        {
            foreach (var endPoint in Connection!.GetEndPoints(configuredOnly: true))
            {
                var server = Connection.GetServer(endPoint);
                if (server.ServerType != ServerType.Cluster)
                {
                    await Connection.GetDatabase().PingAsync().ConfigureAwait(false);
                    await server.PingAsync().ConfigureAwait(false);
                }
                else
                {
                    var clusterInfo = await server.ExecuteAsync("CLUSTER", "INFO").ConfigureAwait(false);
                    if (clusterInfo is object && !clusterInfo.IsNull)
                    {
                        if (!clusterInfo.ToString()!.Contains("cluster_state:ok"))
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

    public IDatabase GetDatabase() => Connection.GetDatabase();

    public ISubscriber GetSubscriber() => Connection.GetSubscriber();
}
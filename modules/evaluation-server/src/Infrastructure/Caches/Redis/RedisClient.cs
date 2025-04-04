using Microsoft.Extensions.Configuration;
using StackExchange.Redis;

namespace Infrastructure.Caches.Redis;

public class RedisClient : IRedisClient
{
    private readonly Lazy<ConnectionMultiplexer> _lazyConnection;

    public IConnectionMultiplexer Connection => _lazyConnection.Value;

    public RedisClient(IConfiguration configuration)
    {
        var connectionString = configuration.GetRedisConnectionString();

        _lazyConnection = new Lazy<ConnectionMultiplexer>(
            () => ConnectionMultiplexer.Connect(connectionString)
        );
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
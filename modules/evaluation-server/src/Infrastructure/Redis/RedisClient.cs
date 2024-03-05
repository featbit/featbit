using Microsoft.Extensions.Options;
using StackExchange.Redis;

namespace Infrastructure.Redis;

public class RedisClient : IRedisClient
{
    private readonly Lazy<ConnectionMultiplexer> _lazyConnection;
    private IConnectionMultiplexer ConnectionMultiplexer => _lazyConnection.Value;

    public RedisClient(IOptions<RedisOptions> options)
    {
        var value = options.Value;

        var connectionString = value.ConnectionString;
        var configurationOptions = ConfigurationOptions.Parse(connectionString);

        // if user has specified a password in the configuration, use it
        var password = value.Password;
        if (!string.IsNullOrWhiteSpace(password))
        {
            configurationOptions.Password = password;
        }

        _lazyConnection = new Lazy<ConnectionMultiplexer>(
            () => StackExchange.Redis.ConnectionMultiplexer.Connect(configurationOptions)
        );
    }

    // ReSharper disable once CognitiveComplexity
    public async Task<bool> IsHealthyAsync()
    {
        // reference: https://github.com/Xabaril/AspNetCore.Diagnostics.HealthChecks/blob/master/src/HealthChecks.Redis/RedisHealthCheck.cs
        try
        {
            foreach (var endPoint in ConnectionMultiplexer!.GetEndPoints(configuredOnly: true))
            {
                var server = ConnectionMultiplexer.GetServer(endPoint);
                if (server.ServerType != ServerType.Cluster)
                {
                    await ConnectionMultiplexer.GetDatabase().PingAsync().ConfigureAwait(false);
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

    public IDatabase GetDatabase() => ConnectionMultiplexer.GetDatabase();

    public ISubscriber GetSubscriber() => ConnectionMultiplexer.GetSubscriber();
}
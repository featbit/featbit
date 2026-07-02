using Microsoft.Extensions.Configuration;
using StackExchange.Redis;

namespace Infrastructure.Caches.Redis;

public class RedisClient : IRedisClient
{
    private readonly Lazy<ConnectionMultiplexer> _lazyConnection;

    public IConnectionMultiplexer Connection => _lazyConnection.Value;

    public IDatabase GetDatabase() => Connection.GetDatabase();

    public RedisClient(IConfiguration configuration)
    {
        var connectionString = configuration.GetRedisConnectionString();

        _lazyConnection = new Lazy<ConnectionMultiplexer>(
            () => ConnectionMultiplexer.Connect(connectionString)
        );
    }
}
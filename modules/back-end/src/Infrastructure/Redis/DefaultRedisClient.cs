using Microsoft.Extensions.Configuration;
using StackExchange.Redis;

namespace Infrastructure.Redis;

public class DefaultRedisClient : IRedisClient
{
    private readonly Lazy<ConnectionMultiplexer> _lazyConnection;
    private ConnectionMultiplexer ConnectionMultiplexer => _lazyConnection.Value;

    public IDatabase GetDatabase() => ConnectionMultiplexer.GetDatabase();

    public DefaultRedisClient(IConfiguration configuration)
    {
        _lazyConnection = new Lazy<ConnectionMultiplexer>(
            () => ConnectionMultiplexer.Connect(configuration["Redis:ConnectionString"])
        );
    }
}
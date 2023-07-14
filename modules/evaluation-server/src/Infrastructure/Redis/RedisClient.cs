using StackExchange.Redis;

namespace Infrastructure.Redis;

public class RedisClient
{
    private readonly IConnectionMultiplexer _connectionMultiplexer;

    public RedisClient(RedisOptions options)
    {
        _connectionMultiplexer = ConnectionMultiplexer.Connect(options.ConnectionString);
    }

    public IDatabase GetDatabase() => _connectionMultiplexer.GetDatabase();

    public ISubscriber GetSubscriber() => _connectionMultiplexer.GetSubscriber();
}
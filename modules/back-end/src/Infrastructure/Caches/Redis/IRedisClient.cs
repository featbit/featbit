using StackExchange.Redis;

namespace Infrastructure.Caches.Redis;

public interface IRedisClient
{
    IConnectionMultiplexer Connection { get; }

    IDatabase GetDatabase();
}
using StackExchange.Redis;

namespace Infrastructure.Caches.Redis;

public interface IRedisClient
{
    IConnectionMultiplexer Connection { get; }

    Task<bool> IsHealthyAsync();

    IDatabase GetDatabase();

    ISubscriber GetSubscriber();
}
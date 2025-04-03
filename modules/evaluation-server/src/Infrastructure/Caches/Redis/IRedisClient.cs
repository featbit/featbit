using StackExchange.Redis;

namespace Infrastructure.Caches.Redis;

public interface IRedisClient
{
    Task<bool> IsHealthyAsync();

    IDatabase GetDatabase();

    ISubscriber GetSubscriber();
}
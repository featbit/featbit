using StackExchange.Redis;

namespace Infrastructure.Caches.Redis;

public interface IRedisClient
{
    IDatabase GetDatabase();
}
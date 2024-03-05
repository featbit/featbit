using StackExchange.Redis;

namespace Infrastructure.Redis;

public interface IRedisClient
{
    Task<bool> IsHealthyAsync();

    IDatabase GetDatabase();

    ISubscriber GetSubscriber();
}
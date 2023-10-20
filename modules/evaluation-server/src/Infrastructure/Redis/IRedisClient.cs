using StackExchange.Redis;

namespace Infrastructure.Redis;

public interface IRedisClient
{
    bool IsConnected { get; }

    IDatabase GetDatabase();

    ISubscriber GetSubscriber();
}
using StackExchange.Redis;

namespace Infrastructure.Redis;

public interface IRedisClient
{
    IDatabase GetDatabase();
}
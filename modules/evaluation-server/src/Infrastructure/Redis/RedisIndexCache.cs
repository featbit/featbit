using StackExchange.Redis;

namespace Infrastructure.Redis;

public class RedisIndexCache
{
    public RedisKey Key { get; set; }

    public RedisValue Value { get; set; }

    public double Score { get; set; }
}
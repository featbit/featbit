using StackExchange.Redis;

namespace Infrastructure.Redis;

public class RedisIndex
{
    public RedisKey Key { get; set; }

    public RedisValue Member { get; set; }

    public double Score { get; set; }
}
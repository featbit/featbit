using Infrastructure.Readiness;

namespace Infrastructure.Redis;

public class RedisReadinessCheck : ReadinessCheck
{
    public RedisReadinessCheck(IRedisClient redisClient) 
        : base(healthyCheck: redisClient.IsHealthyAsync, serviceName: "Redis")
    {  }
}

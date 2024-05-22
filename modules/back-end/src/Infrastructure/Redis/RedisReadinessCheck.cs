using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace Infrastructure.Redis;

public class RedisReadinessCheck : IHealthCheck
{
    private readonly IRedisClient _redisClient;

    public RedisReadinessCheck(IRedisClient redisClient) 
    {  
        _redisClient = redisClient; 
    }

    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        try 
        {
            await _redisClient.GetDatabase().PingAsync();
        }
        catch (Exception exception) 
        {
            return HealthCheckResult.Unhealthy("Redis is currently unavailable.", exception);
        }

        return HealthCheckResult.Healthy("Redis is currently available.");
    }
}

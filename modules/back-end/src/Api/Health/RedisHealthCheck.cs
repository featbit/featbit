using Infrastructure.Redis;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace Api.Health
{
    public class RedisHealthCheck : IHealthCheck
    {
        private readonly IRedisClient _redisClient;

        public RedisHealthCheck(IRedisClient redisClient) 
        {  
            _redisClient = redisClient; 
        }

        public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
        {
            try 
            {
                await _redisClient.GetDatabase().PingAsync();
            }
            catch (Exception error) 
            {
                return HealthCheckResult.Unhealthy("Redis is currently unavailable", error);
            }

            return HealthCheckResult.Healthy("Redis is currently available.");
        }
    }
}

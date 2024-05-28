using Infrastructure.Redis;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Moq;
using System.Threading.Tasks;
using Xunit;

namespace Infrastructure.UnitTests;

public class RedisReadinessCheckTests : ReadinessTest
{
    private readonly Mock<IRedisClient> _mockedRedisClient;
    private readonly RedisReadinessCheck _redisReadinessCheck;

    public RedisReadinessCheckTests() : base()
    {
        _mockedRedisClient = new();
        _redisReadinessCheck = new(_mockedRedisClient.Object);
    }

    [Fact]
    public async Task ItReturnsHealthyWhenRedisIsAvailable()
    {
        _mockedRedisClient.Setup(mongoDbClient => mongoDbClient.IsHealthyAsync()).ReturnsAsync(true);

        var actual = await _redisReadinessCheck.CheckHealthAsync(healthCheckContext);
        var expected = HealthCheckResult.Healthy("Redis is currently available.");

        Assert.Equal(expected.Description, actual.Description);
        Assert.Equal(expected.Status, actual.Status);
    }

    [Fact]
    public async Task ItReturnsUnhealthyWhenRedisIsUnavailable()
    {
        _mockedRedisClient.Setup(mongoDbClient => mongoDbClient.IsHealthyAsync()).ReturnsAsync(false);

        var actual = await _redisReadinessCheck.CheckHealthAsync(healthCheckContext);
        var expected = HealthCheckResult.Unhealthy("Redis is currently unavailable.");

        Assert.Equal(expected.Status, actual.Status);
        Assert.Equal(expected.Description, actual.Description);
        Assert.Equal(expected.Exception, actual.Exception);
    }
}

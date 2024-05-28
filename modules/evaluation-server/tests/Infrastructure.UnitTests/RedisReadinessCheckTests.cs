using Infrastructure.Redis;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Moq;
using System.Collections;
using System.Collections.Generic;
using System.Threading.Tasks;
using Xunit;

namespace Infrastructure.UnitTests;

public class RedisReadinessCheckTests : ReadinessTest
{
    private readonly Mock<IRedisClient> _mockedRedisClient;
    private readonly RedisReadinessCheck _redisReadinessCheck;

    public RedisReadinessCheckTests() : base()
    {
        _mockedRedisClient = new Mock<IRedisClient>();
        _redisReadinessCheck = new RedisReadinessCheck(_mockedRedisClient.Object);
    }

    [Theory]
    [ClassData(typeof(RedisReadinessCheckTestData))]
    public async Task ItReturnsTheExpectedStatus(bool isRedisAvailable, HealthCheckResult expecetedCheckResult)
    {
        _mockedRedisClient.Setup(mongoDbClient => mongoDbClient.IsHealthyAsync()).ReturnsAsync(isRedisAvailable);

        var actual = await _redisReadinessCheck.CheckHealthAsync(healthCheckContext);

        Assert.Equal(expecetedCheckResult.Status, actual.Status);
        Assert.Equal(expecetedCheckResult.Description, actual.Description);
        Assert.Equal(expecetedCheckResult.Exception, actual.Exception);
    }
}

class RedisReadinessCheckTestData : IEnumerable<object[]>
{
    public IEnumerator<object[]> GetEnumerator()
    {
        yield return new object[] {
            true,
            HealthCheckResult.Healthy("Redis is currently available.")
        };

        yield return new object[] {
            false,
            HealthCheckResult.Unhealthy("Redis is currently unavailable.")
        };
    }

    IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
}

using Microsoft.Extensions.Diagnostics.HealthChecks;
using Infrastructure.Redis;

namespace Application.UnitTests.ReadinessChecks;

public class RedisReadinessCheckTests
{
    private readonly HealthCheckContext _context;
    private readonly Mock<IRedisClient> _mockedRedisClient;

    public RedisReadinessCheckTests()
    {
        _mockedRedisClient = new();
        _context = new();
    }

    [Fact]
    public async Task ReturnsHealthyIfRedisIsAvailable()
    {
        var readinessCheck = new RedisReadinessCheck(_mockedRedisClient.Object);

        var expected = HealthCheckResult.Healthy("Redis is currently available.");
        var actual = await readinessCheck.CheckHealthAsync(_context);

        Assert.Equal(expected.Description, actual.Description);
        Assert.Equal(expected.Status, actual.Status);
    }

    [Fact]
    public async Task ReturnsUnhealthyIfRedisIsUnavailable()
    {
        var testRedisError = new Exception("Test Redis error");
        _mockedRedisClient.Setup(client => client.PingAsync()).ThrowsAsync(testRedisError);

        var readinessCheck = new RedisReadinessCheck(_mockedRedisClient.Object);

        var expected = HealthCheckResult.Unhealthy("Redis is currently unavailable.", testRedisError);
        var actual = await readinessCheck.CheckHealthAsync(_context);

        Assert.Equal(expected.Exception, actual.Exception);
        Assert.Equal(expected.Description, actual.Description);
        Assert.Equal(expected.Status, actual.Status);
    }
}

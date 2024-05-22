using Microsoft.Extensions.Diagnostics.HealthChecks;
using Infrastructure.Redis;
using StackExchange.Redis;

namespace Application.UnitTests.ReadinessChecks;

public class RedisReadinessCheckTests
{
    private static readonly HealthCheckContext _context = new();
    private static readonly Mock<IRedisClient> _mockedRedisClient = new Mock<IRedisClient>();
    private static readonly Mock<IDatabase> _mockedRedisDatabase = new Mock<IDatabase>();

    public RedisReadinessCheckTests()
    {
        _mockedRedisClient.Setup(client => client.GetDatabase()).Returns(_mockedRedisDatabase.Object);
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
        _mockedRedisDatabase.Setup(database 
            => database.PingAsync(It.IsAny<CommandFlags>())).ThrowsAsync(testRedisError);
        
        var readinessCheck = new RedisReadinessCheck(_mockedRedisClient.Object);

        var expected = HealthCheckResult.Unhealthy("Redis is currently unavailable.", testRedisError);
        var actual = await readinessCheck.CheckHealthAsync(_context);

        Assert.Equal(expected.Exception, actual.Exception);
        Assert.Equal(expected.Description, actual.Description);
        Assert.Equal(expected.Status, actual.Status);
    }
}

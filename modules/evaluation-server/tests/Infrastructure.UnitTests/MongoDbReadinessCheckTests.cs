using Infrastructure.MongoDb;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Moq;
using System.Threading.Tasks;
using Xunit;

namespace Infrastructure.UnitTests;

public class MongoDbReadinessCheckTests : ReadinessTest
{
    private readonly Mock<IMongoDbClient> _mockedMongoDbClient;
    private readonly MongoDbReadinessCheck _mongoDbReadinessCheck;

    public MongoDbReadinessCheckTests() : base()
    {
        _mockedMongoDbClient = new();
        _mongoDbReadinessCheck = new(_mockedMongoDbClient.Object);
    }

    [Fact]
    public async Task ItReturnsHealthyWhenMongoIsAvailable()
    {
        _mockedMongoDbClient.Setup(mongoDbClient => mongoDbClient.IsHealthyAsync()).ReturnsAsync(true);

        var actual = await _mongoDbReadinessCheck.CheckHealthAsync(healthCheckContext);
        var expected = HealthCheckResult.Healthy("The MongoDB database is currently available.");

        Assert.Equal(expected.Description, actual.Description);
        Assert.Equal(expected.Status, actual.Status);
    }

    [Fact]
    public async Task ItReturnsUnhealthyWhenMongoIsUnavailable()
    {
        _mockedMongoDbClient.Setup(mongoDbClient => mongoDbClient.IsHealthyAsync()).ReturnsAsync(false);

        var actual = await _mongoDbReadinessCheck.CheckHealthAsync(healthCheckContext);
        var expected = HealthCheckResult.Unhealthy("The MongoDB database is currently unavailable.");

        Assert.Equal(expected.Status, actual.Status);
        Assert.Equal(expected.Description, actual.Description);
        Assert.Equal(expected.Exception, actual.Exception);
    }
}

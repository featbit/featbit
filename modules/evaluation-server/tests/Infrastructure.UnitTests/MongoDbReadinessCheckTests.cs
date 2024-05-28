using Infrastructure.MongoDb;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Moq;
using System.Collections;
using System.Collections.Generic;
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

    [Theory]
    [ClassData(typeof(MongoDbReadinessCheckTestData))]
    public async Task ItReturnsTheExpectedStatus(bool isMongoAvailable, HealthCheckResult expecetedCheckResult)
    {
        _mockedMongoDbClient.Setup(mongoDbClient => mongoDbClient.IsHealthyAsync()).ReturnsAsync(isMongoAvailable);

        var actual = await _mongoDbReadinessCheck.CheckHealthAsync(healthCheckContext);

        Assert.Equal(expecetedCheckResult.Status, actual.Status);
        Assert.Equal(expecetedCheckResult.Description, actual.Description);
        Assert.Equal(expecetedCheckResult.Exception, actual.Exception);
    }
}

class MongoDbReadinessCheckTestData : IEnumerable<object[]>
{
    public IEnumerator<object[]> GetEnumerator()
    {
        yield return new object[] { 
            true,
            HealthCheckResult.Healthy("The MongoDB database is currently available.")
        };

        yield return new object[] {
            false,
            HealthCheckResult.Unhealthy("The MongoDB database is currently unavailable.")
        };
    }

    IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
}

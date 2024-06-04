using Infrastructure.MongoDb;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Options;

namespace Application.UnitTests.ReadinessChecks;

public class MongoDbReadinessCheckTests
{
    private readonly Mock<MongoDbClient> _mockedMongoDbClient;
    private readonly HealthCheckContext _context;

    public MongoDbReadinessCheckTests()
    {
        _mockedMongoDbClient = new(Options.Create(new MongoDbOptions()
        {
            ConnectionString = "mongodb://test:abcxyz@localhost:27017",
            Database = "DoesNotExist"
        }));

        _context = new();
    }

    [Fact]
    public async Task ItReturnsHealthyWhenMongoIsAvailable()
    {
        _mockedMongoDbClient.Setup(client => client.PingAsync()).Returns(Task.CompletedTask);

        var mongoDbReadinessCheck = new MongoDbReadinessCheck(_mockedMongoDbClient.Object);
        var actual = await mongoDbReadinessCheck.CheckHealthAsync(_context);
        var expected = HealthCheckResult.Healthy("The MongoDB database is currently available.");

        Assert.Equal(expected.Description, actual.Description);
        Assert.Equal(expected.Status, actual.Status);
    }

    [Fact]
    public async Task ItReturnsUnhealthyWhenMongoIsUnavailable()
    {
        var thrownException = new Exception("Test Mongo Error");
        _mockedMongoDbClient.Setup(client => client.PingAsync()).ThrowsAsync(thrownException);

        var mongoDbReadinessCheck = new MongoDbReadinessCheck(_mockedMongoDbClient.Object);
        var actual = await mongoDbReadinessCheck.CheckHealthAsync(_context);
        var expected = HealthCheckResult.Unhealthy(
            "The MongoDB database is currently unavailable.",
            thrownException
        );

        Assert.Equal(expected.Status, actual.Status);
        Assert.Equal(expected.Description, actual.Description);
        Assert.Equal(expected.Exception, actual.Exception);
    }
}

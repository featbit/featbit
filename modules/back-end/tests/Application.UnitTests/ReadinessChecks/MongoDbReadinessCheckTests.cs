using Domain.FeatureFlags;
using Infrastructure.MongoDb;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Options;
using MongoDB.Driver;
using Command = MongoDB.Driver.Command<MongoDB.Bson.RawBsonDocument>;

namespace Application.UnitTests.ReadinessChecks;

public class MongoDbReadinessCheckTests
{
    private readonly Mock<MongoDbClient> _mockedMongoDbClient;
    private readonly Mock<IMongoCollection<FeatureFlag>> _mockedFeatureFlagCollection;
    private readonly Mock<IMongoDatabase> _mockedMongoDatabase;
    private readonly HealthCheckContext _context;

    public MongoDbReadinessCheckTests()
    {
        _mockedMongoDbClient = new Mock<MongoDbClient>(Options.Create(new MongoDbOptions()
        {
            ConnectionString = "mongodb://test:abcxyz@localhost:27017",
            Database = "DoesNotExist"
        }));
        
        _mockedFeatureFlagCollection = new Mock<IMongoCollection<FeatureFlag>>();
        _mockedMongoDbClient.Setup(mongo => mongo.CollectionOf<FeatureFlag>())
            .Returns(_mockedFeatureFlagCollection.Object);

        _mockedMongoDatabase = new Mock<IMongoDatabase>();
        _mockedFeatureFlagCollection.Setup(collection => collection.Database)
            .Returns(_mockedMongoDatabase.Object);

        _context = new();
    }

    [Fact]
    public async Task ItReturnsHealthyWhenMongoIsAvailable()
    {
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
        _mockedMongoDatabase.Setup(database => database.RunCommandAsync(
            It.IsAny<Command>(), 
            It.IsAny<ReadPreference>(), 
            It.IsAny<CancellationToken>()
        )).ThrowsAsync(thrownException);

        var mongoDbReadinessCheck = new MongoDbReadinessCheck(_mockedMongoDbClient.Object);
        var actual = await mongoDbReadinessCheck.CheckHealthAsync(_context);
        var expected = HealthCheckResult.Unhealthy("The MongoDB database is currently unavailable.", thrownException);

        Assert.Equal(expected.Status, actual.Status);
        Assert.Equal(expected.Description, actual.Description);
        Assert.Equal(expected.Exception, actual.Exception);
    }
}

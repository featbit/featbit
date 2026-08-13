using Infrastructure.IntegrationTests.Fixtures;
using Infrastructure.Persistence.MongoDb;
using Microsoft.Extensions.Options;
using MongoDB.Driver;

namespace Infrastructure.IntegrationTests.Persistence.MongoDb;

[Collection(MongoCollection.Name)]
public class MongoDbClientTests : IntegrationTestBase
{
    private readonly MongoDbFixture _fixture;

    public MongoDbClientTests(MongoDbFixture fixture)
    {
        _fixture = fixture;
    }

    [DockerFact]
    public async Task IsHealthyAsync_ConnectedContainer_ReturnsTrue()
    {
        var sut = new MongoDbClient(Options.Create(new MongoDbOptions
        {
            ConnectionString = _fixture.ConnectionString,
            Database = $"health-{Guid.NewGuid():N}"
        }));

        var healthy = await sut.IsHealthyAsync();

        Assert.True(healthy);
    }

    [DockerFact]
    public async Task IsHealthyAsync_UnreachableHost_ReturnsFalse()
    {
        var sut = new MongoDbClient(Options.Create(new MongoDbOptions
        {
            // Reserved TEST-NET address — guaranteed not to respond.
            ConnectionString = "mongodb://198.51.100.1:27017/?connectTimeoutMS=500&serverSelectionTimeoutMS=500",
            Database = "ignored"
        }));

        var healthy = await sut.IsHealthyAsync();

        Assert.False(healthy);
    }

    [DockerFact]
    public void Database_ExposesConfiguredDatabaseName()
    {
        var dbName = $"named-{Guid.NewGuid():N}";
        var sut = new MongoDbClient(Options.Create(new MongoDbOptions
        {
            ConnectionString = _fixture.ConnectionString,
            Database = dbName
        }));

        Assert.Equal(dbName, sut.Database.DatabaseNamespace.DatabaseName);
    }
}

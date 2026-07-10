using Infrastructure.IntegrationTests.Fixtures;
using MongoDB.Bson;
using MongoDB.Driver;

namespace Infrastructure.IntegrationTests.Smoke;

[Collection(MongoCollection.Name)]
public class MongoFixtureSmokeTests : IntegrationTestBase
{
    private readonly MongoDbFixture _fixture;

    public MongoFixtureSmokeTests(MongoDbFixture fixture)
    {
        _fixture = fixture;
    }

    [DockerFact]
    public async Task Fixture_ServesPingCommand()
    {
        var client = new MongoClient(_fixture.ConnectionString);

        var result = await client.GetDatabase("admin").RunCommandAsync<BsonDocument>(new BsonDocument("ping", 1));

        Assert.Equal(1.0, result["ok"].ToDouble());
    }
}

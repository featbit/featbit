using Domain.FeatureFlags;
using Domain.Workspaces;
using Infrastructure.IntegrationTests.Fixtures;
using Infrastructure.Persistence.MongoDb;
using Microsoft.Extensions.Options;
using MongoDB.Bson;
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

    private MongoDbClient NewClient(string? database = null)
    {
        return new MongoDbClient(Options.Create(new MongoDbOptions
        {
            ConnectionString = _fixture.ConnectionString,
            Database = database ?? $"be-mongo-{Guid.NewGuid():N}"
        }));
    }

    [DockerFact]
    public void Database_ExposesConfiguredDatabaseName()
    {
        var dbName = $"named-{Guid.NewGuid():N}";
        var sut = NewClient(dbName);

        Assert.Equal(dbName, sut.Database.DatabaseNamespace.DatabaseName);
    }

    [DockerFact]
    public void CollectionNameOf_RegisteredType_ReturnsMappedName()
    {
        var sut = NewClient();

        Assert.Equal("FeatureFlags", sut.CollectionNameOf<FeatureFlag>());
        Assert.Equal("Workspaces", sut.CollectionNameOf<Workspace>());
    }

    [DockerFact]
    public void CollectionNameOf_UnregisteredType_ThrowsArgumentException()
    {
        var sut = NewClient();

        Assert.Throws<ArgumentException>(() => sut.CollectionNameOf<MongoDbClientTests>());
    }

    [DockerFact]
    public void CollectionOf_Generic_UsesMappedCollectionName()
    {
        var sut = NewClient();

        var collection = sut.CollectionOf<FeatureFlag>();

        Assert.Equal("FeatureFlags", collection.CollectionNamespace.CollectionName);
    }

    [DockerFact]
    public void CollectionOf_StringName_ReturnsBsonDocumentCollection()
    {
        var sut = NewClient();

        var collection = sut.CollectionOf("Arbitrary");

        Assert.Equal("Arbitrary", collection.CollectionNamespace.CollectionName);
        Assert.Equal(typeof(BsonDocument), collection.DocumentSerializer.ValueType);
    }

    [DockerFact]
    public async Task CollectionOf_Generic_RoundTripsAnEntity()
    {
        var sut = NewClient();
        var flag = new FeatureFlag(
            envId: Guid.NewGuid(),
            name: "round-trip",
            description: "desc",
            key: "round-trip",
            isEnabled: true,
            variationType: "boolean",
            variations:
            [
                new Variation { Id = "v1", Name = "true", Value = "true" },
                new Variation { Id = "v2", Name = "false", Value = "false" }
            ],
            disabledVariationId: "v2",
            enabledVariationId: "v1",
            tags: [],
            currentUserId: Guid.NewGuid());

        var collection = sut.CollectionOf<FeatureFlag>();
        await collection.InsertOneAsync(flag);

        var loaded = await collection.Find(x => x.Id == flag.Id).FirstOrDefaultAsync();
        Assert.NotNull(loaded);
        Assert.Equal("round-trip", loaded.Name);
    }

    [DockerFact]
    public void QueryableOf_ReturnsQueryableForMappedCollection()
    {
        var sut = NewClient();

        var queryable = sut.QueryableOf<FeatureFlag>();

        Assert.NotNull(queryable);
    }
}

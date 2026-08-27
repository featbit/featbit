using Application.EndUsers;
using Domain.EndUsers;
using Infrastructure.IntegrationTests.Fixtures;
using Infrastructure.Persistence.MongoDb;
using Infrastructure.Services.MongoDb;
using Microsoft.Extensions.Options;
using MongoDB.Driver;

namespace Infrastructure.IntegrationTests.Services.CosmosDB;

[Collection(CosmosMongoCollection.Name)]
public class EndUserServiceTests : IntegrationTestBase
{
    private readonly CosmosMongoDbFixture _fixture;

    public EndUserServiceTests(CosmosMongoDbFixture fixture)
    {
        _fixture = fixture;
    }

    [DockerFact]
    public async Task SearchAsync_GlobalAndEnvironmentUsers_ReturnsMergedFilteredPage()
    {
        var databaseName = $"end-user-search-{Guid.NewGuid():N}";
        await _fixture.CreateDatabaseAsync(databaseName, "EndUsers");
        var client = new MongoDbClient(Options.Create(new MongoDbOptions
        {
            ConnectionString = _fixture.ConnectionString,
            Database = databaseName
        }));
        var workspaceId = Guid.NewGuid();
        var envId = Guid.NewGuid();
        var excludedKeyId = "match-excluded";
        var users = new[]
        {
            NewUser(workspaceId, null, "match-global-1", "Global one", 9,
                Guid.Parse("00000000-0000-0000-0000-000000000001")),
            NewUser(null, envId, "match-env-1", "Environment one", 9,
                Guid.Parse("00000000-0000-0000-0000-000000000002")),
            NewUser(workspaceId, null, "global-2", "Match global two", 6),
            NewUser(null, envId, "env-2", "Match environment two", 7),
            NewUser(workspaceId, null, "match-global-3", "Global three", 4),
            NewUser(null, envId, "match-env-3", "Environment three", 5),
            NewUser(workspaceId, null, excludedKeyId, "Match excluded", 10),
            NewUser(Guid.NewGuid(), null, "match-other-workspace", "Other workspace", 12),
            NewUser(null, Guid.NewGuid(), "match-other-env", "Other environment", 11),
            NewUser(workspaceId, null, "not-in-result", "No result", 13)
        };
        var collection = client.CollectionOf<EndUser>();
        await collection.Indexes.CreateManyAsync([
            new CreateIndexModel<EndUser>(
                Builders<EndUser>.IndexKeys
                    .Ascending(x => x.EnvId)
                    .Descending(x => x.UpdatedAt)
                    .Descending(x => x.Id)),
            new CreateIndexModel<EndUser>(
                Builders<EndUser>.IndexKeys
                    .Ascending(x => x.WorkspaceId)
                    .Descending(x => x.UpdatedAt)
                    .Descending(x => x.Id)),
            new CreateIndexModel<EndUser>(
                Builders<EndUser>.IndexKeys
                    .Descending(x => x.UpdatedAt)
                    .Descending(x => x.Id))
        ]);
        await collection.InsertManyAsync(users);
        var sut = new EndUserService(client);

        var result = await sut.SearchAsync(workspaceId, envId, new EndUserSearchFilter
        {
            SearchText = "match",
            ExcludedKeyIds = [excludedKeyId],
            GlobalUserOnly = false,
            Limit = 5
        });

        Assert.Equal(
            ["match-env-1", "match-global-1", "env-2", "global-2", "match-env-3"],
            result.Select(x => x.KeyId));
    }

    private static EndUser NewUser(
        Guid? workspaceId,
        Guid? envId,
        string keyId,
        string name,
        int updatedAtMinute,
        Guid? id = null)
    {
        var timestamp = new DateTime(2026, 8, 19, 0, updatedAtMinute, 0, DateTimeKind.Utc);
        return new EndUser(workspaceId, envId, keyId, name, [])
        {
            Id = id ?? Guid.NewGuid(),
            CreatedAt = timestamp,
            UpdatedAt = timestamp
        };
    }
}

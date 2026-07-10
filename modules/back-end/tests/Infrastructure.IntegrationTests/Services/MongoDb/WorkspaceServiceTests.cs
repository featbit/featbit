using Domain.Users;
using Domain.Workspaces;
using Infrastructure.IntegrationTests.Fixtures;
using Infrastructure.Persistence.MongoDb;
using Infrastructure.Services.MongoDb;
using Microsoft.Extensions.Options;
using MongoDB.Driver;
using MongoDB.Driver.Linq;

namespace Infrastructure.IntegrationTests.Services.MongoDb;

[Collection(MongoCollection.Name)]
public class WorkspaceServiceTests : IntegrationTestBase
{
    private readonly MongoDbFixture _fixture;

    public WorkspaceServiceTests(MongoDbFixture fixture)
    {
        _fixture = fixture;
    }

    private WorkspaceService NewService(out MongoDbClient client)
    {
        client = new MongoDbClient(Options.Create(new MongoDbOptions
        {
            ConnectionString = _fixture.ConnectionString,
            Database = $"be-ws-{Guid.NewGuid():N}"
        }));
        return new WorkspaceService(client);
    }

    private static Workspace NewWorkspace(string key) => new() { Key = key, Name = key };

    [DockerFact]
    public async Task HasKeyBeenUsedAsync_KeyTakenByDifferentWorkspace_ReturnsTrue()
    {
        var sut = NewService(out _);
        var ws = NewWorkspace("taken");
        await sut.AddOneAsync(ws);

        Assert.True(await sut.HasKeyBeenUsedAsync(Guid.NewGuid(), "Taken"));
    }

    [DockerFact]
    public async Task HasKeyBeenUsedAsync_KeyBelongsToSameWorkspace_ReturnsFalse()
    {
        var sut = NewService(out _);
        var ws = NewWorkspace("mine");
        await sut.AddOneAsync(ws);

        Assert.False(await sut.HasKeyBeenUsedAsync(ws.Id, "mine"));
    }

    [DockerFact]
    public async Task GetDefaultWorkspaceAsync_SingleWorkspace_ReturnsItsKey()
    {
        var sut = NewService(out _);
        await sut.AddOneAsync(NewWorkspace("only"));

        Assert.Equal("only", await sut.GetDefaultWorkspaceAsync());
    }

    [DockerFact]
    public async Task GetDefaultWorkspaceAsync_MultipleWorkspaces_ReturnsEmptyString()
    {
        var sut = NewService(out _);
        await sut.AddOneAsync(NewWorkspace("a"));
        await sut.AddOneAsync(NewWorkspace("b"));

        Assert.Equal(string.Empty, await sut.GetDefaultWorkspaceAsync());
    }

    [DockerFact]
    public async Task GetDefaultWorkspaceAsync_NoWorkspaces_ReturnsEmptyString()
    {
        var sut = NewService(out _);

        Assert.Equal(string.Empty, await sut.GetDefaultWorkspaceAsync());
    }

    [DockerFact]
    public async Task AddUserIfNotExistsAsync_NewLink_InsertsRow()
    {
        var sut = NewService(out var client);
        var workspaceId = Guid.NewGuid();
        var userId = Guid.NewGuid();

        await sut.AddUserIfNotExistsAsync(workspaceId, userId);

        var count = await client.QueryableOf<WorkspaceUser>()
            .CountAsync(x => x.WorkspaceId == workspaceId && x.UserId == userId);
        Assert.Equal(1, count);
    }

    [DockerFact]
    public async Task AddUserIfNotExistsAsync_ExistingLink_DoesNotDuplicate()
    {
        var sut = NewService(out var client);
        var workspaceId = Guid.NewGuid();
        var userId = Guid.NewGuid();

        await sut.AddUserIfNotExistsAsync(workspaceId, userId);
        await sut.AddUserIfNotExistsAsync(workspaceId, userId);

        var count = await client.QueryableOf<WorkspaceUser>()
            .CountAsync(x => x.WorkspaceId == workspaceId && x.UserId == userId);
        Assert.Equal(1, count);
    }

    [DockerFact]
    public async Task RemoveUserAsync_RemovesAllMatchingLinks()
    {
        var sut = NewService(out var client);
        var workspaceId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var otherUserId = Guid.NewGuid();

        await sut.AddUserIfNotExistsAsync(workspaceId, userId);
        await sut.AddUserIfNotExistsAsync(workspaceId, otherUserId);

        await sut.RemoveUserAsync(workspaceId, userId);

        var remaining = await client.QueryableOf<WorkspaceUser>()
            .Where(x => x.WorkspaceId == workspaceId).ToListAsync();
        Assert.Equal(otherUserId, Assert.Single(remaining).UserId);
    }
}

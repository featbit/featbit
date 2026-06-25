using Domain.Users;
using Domain.Workspaces;
using Infrastructure.IntegrationTests.Fixtures;
using Infrastructure.IntegrationTests.Support;
using Infrastructure.Persistence.EntityFrameworkCore;
using Infrastructure.Services.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.IntegrationTests.Services.EntityFrameworkCore;

[Collection(FeatBitPostgresCollection.Name)]
public class WorkspaceServiceTests : IntegrationTestBase
{
    private readonly FeatBitPostgresFixture _fixture;

    public WorkspaceServiceTests(FeatBitPostgresFixture fixture)
    {
        _fixture = fixture;
    }

    private (WorkspaceService Service, AppDbContext Db) NewService()
    {
        var db = AppDbContextFactory.Create(_fixture.ConnectionString);
        return (new WorkspaceService(db), db);
    }

    private static Workspace NewWorkspace(string key) =>
        new() { Id = Guid.NewGuid(), Key = key, Name = key };

    private async Task TruncateWorkspacesAsync(AppDbContext db)
    {
        // GetDefaultWorkspaceAsync depends on the total row count. Reset the
        // shared table so tests in this class observe a clean slate.
        await db.Database.ExecuteSqlRawAsync(
            "TRUNCATE TABLE workspace_users, workspaces RESTART IDENTITY CASCADE;");
    }

    [DockerFact]
    public async Task HasKeyBeenUsedAsync_KeyTakenByDifferentWorkspace_ReturnsTrue()
    {
        var (sut, db) = NewService();
        await using var _ = db;
        var ws = NewWorkspace($"taken-{Guid.NewGuid():N}");
        await sut.AddOneAsync(ws);

        Assert.True(await sut.HasKeyBeenUsedAsync(Guid.NewGuid(), ws.Key.ToUpper()));
    }

    [DockerFact]
    public async Task HasKeyBeenUsedAsync_KeyBelongsToSameWorkspace_ReturnsFalse()
    {
        var (sut, db) = NewService();
        await using var _ = db;
        var ws = NewWorkspace($"mine-{Guid.NewGuid():N}");
        await sut.AddOneAsync(ws);

        Assert.False(await sut.HasKeyBeenUsedAsync(ws.Id, ws.Key));
    }

    [DockerFact]
    public async Task GetDefaultWorkspaceAsync_SingleWorkspace_ReturnsItsKey()
    {
        var (sut, db) = NewService();
        await using var _ = db;
        await TruncateWorkspacesAsync(db);
        await sut.AddOneAsync(NewWorkspace("only"));

        Assert.Equal("only", await sut.GetDefaultWorkspaceAsync());
    }

    [DockerFact]
    public async Task GetDefaultWorkspaceAsync_MultipleWorkspaces_ReturnsEmptyString()
    {
        var (sut, db) = NewService();
        await using var _ = db;
        await TruncateWorkspacesAsync(db);
        await sut.AddOneAsync(NewWorkspace("a"));
        await sut.AddOneAsync(NewWorkspace("b"));

        Assert.Equal(string.Empty, await sut.GetDefaultWorkspaceAsync());
    }

    [DockerFact]
    public async Task GetDefaultWorkspaceAsync_NoWorkspaces_ReturnsEmptyString()
    {
        var (sut, db) = NewService();
        await using var _ = db;
        await TruncateWorkspacesAsync(db);

        Assert.Equal(string.Empty, await sut.GetDefaultWorkspaceAsync());
    }

    [DockerFact]
    public async Task AddUserIfNotExistsAsync_NewLink_InsertsRow()
    {
        var (sut, db) = NewService();
        await using var _ = db;
        var workspaceId = Guid.NewGuid();
        var userId = Guid.NewGuid();

        await sut.AddUserIfNotExistsAsync(workspaceId, userId);

        var count = await db.Set<WorkspaceUser>()
            .CountAsync(x => x.WorkspaceId == workspaceId && x.UserId == userId);
        Assert.Equal(1, count);
    }

    [DockerFact]
    public async Task AddUserIfNotExistsAsync_ExistingLink_DoesNotDuplicate()
    {
        var (sut, db) = NewService();
        await using var _ = db;
        var workspaceId = Guid.NewGuid();
        var userId = Guid.NewGuid();

        await sut.AddUserIfNotExistsAsync(workspaceId, userId);
        await sut.AddUserIfNotExistsAsync(workspaceId, userId);

        var count = await db.Set<WorkspaceUser>()
            .CountAsync(x => x.WorkspaceId == workspaceId && x.UserId == userId);
        Assert.Equal(1, count);
    }

    [DockerFact]
    public async Task RemoveUserAsync_RemovesAllMatchingLinks()
    {
        var (sut, db) = NewService();
        await using var _ = db;
        var workspaceId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var otherUserId = Guid.NewGuid();

        await sut.AddUserIfNotExistsAsync(workspaceId, userId);
        await sut.AddUserIfNotExistsAsync(workspaceId, otherUserId);

        await sut.RemoveUserAsync(workspaceId, userId);

        var remaining = await db.Set<WorkspaceUser>()
            .Where(x => x.WorkspaceId == workspaceId).ToListAsync();
        Assert.Equal(otherUserId, Assert.Single(remaining).UserId);
    }
}

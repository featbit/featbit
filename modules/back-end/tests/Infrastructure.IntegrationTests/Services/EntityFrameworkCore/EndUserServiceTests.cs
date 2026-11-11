using Domain.EndUsers;
using Infrastructure.IntegrationTests.Fixtures;
using Infrastructure.Services.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.IntegrationTests.Services.EntityFrameworkCore;

[Collection(FeatBitPostgresCollection.Name)]
public class EndUserServiceTests(FeatBitPostgresFixture fixture) : IntegrationTestBase
{
    private static EndUser NewUser(Guid envId, string name = "Alice", string value = "first") =>
        new(null, envId, "same-key", name, [new EndUserCustomizedProperty { Name = "company", Value = value }]);

    [DockerFact]
    public async Task UpsertAsync_NewUser_PersistsAllFields()
    {
        await using var db = AppDbContextFactory.Create(fixture.ConnectionString);
        var user = NewUser(Guid.NewGuid());

        var result = await new EndUserService(db).UpsertAsync(user);

        var stored = await db.Set<EndUser>().SingleAsync(x => x.EnvId == user.EnvId);
        Assert.Same(user, result);
        Assert.NotEqual(Guid.Empty, stored.Id);
        Assert.Equal(user.Id, stored.Id);
        Assert.True(stored.ValueEquals(user));
        Assert.Equal(user.CreatedAt, stored.CreatedAt, TimeSpan.FromMicroseconds(1));
        Assert.Equal(user.UpdatedAt, stored.UpdatedAt, TimeSpan.FromMicroseconds(1));
    }

    [DockerTheory]
    [InlineData("Bob", "first")]
    [InlineData("Alice", "second")]
    public async Task UpsertAsync_ChangedNameOrProperty_UpdatesValuesAndPreservesIdentity(string name, string value)
    {
        await using var db = AppDbContextFactory.Create(fixture.ConnectionString);
        var service = new EndUserService(db);
        var original = NewUser(Guid.NewGuid());
        original.CreatedAt = original.UpdatedAt = DateTime.UtcNow.AddDays(-1);
        await service.UpsertAsync(original);

        var changed = NewUser(original.EnvId!.Value, name, value);
        await service.UpsertAsync(changed);

        var stored = await db.Set<EndUser>().SingleAsync(x => x.EnvId == original.EnvId);
        Assert.True(stored.ValueEquals(changed));
        Assert.Equal(original.Id, stored.Id);
        Assert.Equal(original.CreatedAt, stored.CreatedAt, TimeSpan.FromMicroseconds(1));
        Assert.True(stored.UpdatedAt > original.UpdatedAt);
    }

    [DockerFact]
    public async Task UpsertAsync_EqualUser_DoesNotWriteRow()
    {
        await using var db = AppDbContextFactory.Create(fixture.ConnectionString);
        var service = new EndUserService(db);
        var original = NewUser(Guid.NewGuid());
        original.CreatedAt = original.UpdatedAt = DateTime.UtcNow.AddDays(-1);
        await service.UpsertAsync(original);
        var versionBefore = await db.Database.SqlQueryRaw<long>(
            "SELECT xmin::text::bigint AS \"Value\" FROM end_users WHERE id = {0}", original.Id).SingleAsync();

        await service.UpsertAsync(NewUser(original.EnvId!.Value));

        var stored = await db.Set<EndUser>().SingleAsync(x => x.Id == original.Id);
        Assert.Equal(original.UpdatedAt, stored.UpdatedAt, TimeSpan.FromMicroseconds(1));
        var versionAfter = await db.Database.SqlQueryRaw<long>(
            "SELECT xmin::text::bigint AS \"Value\" FROM end_users WHERE id = {0}", original.Id).SingleAsync();
        Assert.Equal(versionBefore, versionAfter);
    }

    [DockerTheory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task UpsertAsync_ConcurrentNewUser_AllSucceedAndPersistOneCompleteUser(bool identicalValues)
    {
        var envId = Guid.NewGuid();
        var start = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var ready = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var users = Enumerable.Range(0, 16)
            .Select(i => identicalValues ? NewUser(envId) : NewUser(envId, $"user-{i}", $"value-{i}"))
            .ToArray();
        var remaining = users.Length;
        var tasks = users.Select(async user =>
        {
            await using var db = AppDbContextFactory.Create(fixture.ConnectionString);
            await db.Database.OpenConnectionAsync();
            if (Interlocked.Decrement(ref remaining) == 0)
            {
                ready.SetResult();
            }
            await start.Task;
            await new EndUserService(db).UpsertAsync(user);
        }).ToArray();

        await ready.Task.WaitAsync(TimeSpan.FromSeconds(30));
        start.SetResult();
        await Task.WhenAll(tasks);

        await using var verification = AppDbContextFactory.Create(fixture.ConnectionString);
        var stored = await verification.Set<EndUser>().SingleAsync(x => x.EnvId == envId);
        Assert.Contains(users, user => stored.ValueEquals(user));
    }
}

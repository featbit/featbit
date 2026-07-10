using Domain.EndUsers;
using Domain.Projects;
using Infrastructure.IntegrationTests.Fixtures;
using Infrastructure.IntegrationTests.Support;
using Infrastructure.Persistence.EntityFrameworkCore;
using Infrastructure.Services.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Environment = Domain.Environments.Environment;

namespace Infrastructure.IntegrationTests.Services.EntityFrameworkCore;

[Collection(FeatBitPostgresCollection.Name)]
public class ProjectServiceTests : IntegrationTestBase
{
    private readonly FeatBitPostgresFixture _fixture;

    public ProjectServiceTests(FeatBitPostgresFixture fixture)
    {
        _fixture = fixture;
    }

    private (ProjectService Project, EnvironmentService Env, AppDbContext Db) NewServices()
    {
        var db = AppDbContextFactory.Create(_fixture.ConnectionString);
        var envService = new EnvironmentService(db, NullLogger<EnvironmentService>.Instance);
        var projectService = new ProjectService(db, envService);
        return (projectService, envService, db);
    }

    private static Project NewProject(Guid orgId, string name, string key) =>
        new(orgId, name, key) { Id = Guid.NewGuid() };

    [DockerFact]
    public async Task HasKeyBeenUsedAsync_KeyExistsInOrganization_ReturnsTrue()
    {
        var (sut, _, db) = NewServices();
        await using var _disposable = db;
        var orgId = Guid.NewGuid();
        await sut.AddOneAsync(NewProject(orgId, "P", "Existing"));

        Assert.True(await sut.HasKeyBeenUsedAsync(orgId, "EXISTING"));
        Assert.False(await sut.HasKeyBeenUsedAsync(Guid.NewGuid(), "Existing"));
    }

    [DockerFact]
    public async Task GetWithEnvsAsync_ProjectWithEnvironments_ReturnsProjectAndEnvList()
    {
        var (sut, env, db) = NewServices();
        await using var _disposable = db;
        var orgId = Guid.NewGuid();
        var project = NewProject(orgId, "P", $"p-{Guid.NewGuid():N}");
        await sut.AddOneAsync(project);
        await env.AddManyWithBuiltInPropsAsync(
        [
            new Environment(project.Id, "Dev", "dev") { Id = Guid.NewGuid() },
            new Environment(project.Id, "Prod", "prod") { Id = Guid.NewGuid() }
        ]);

        var result = await sut.GetWithEnvsAsync(project.Id);

        Assert.NotNull(result);
        Assert.Equal(project.Id, result!.Id);
        Assert.Equal(2, result.Environments.Count());
    }

    [DockerFact]
    public async Task GetWithEnvsAsync_UnknownProject_ReturnsNull()
    {
        var (sut, _, db) = NewServices();
        await using var _disposable = db;

        var result = await sut.GetWithEnvsAsync(Guid.NewGuid());

        Assert.Null(result);
    }

    [DockerFact]
    public async Task GetListAsync_ByOrganization_OrdersByCreatedAtDescending()
    {
        var (sut, _, db) = NewServices();
        await using var _disposable = db;
        var orgId = Guid.NewGuid();
        var older = new Project(orgId, "A", $"a-{Guid.NewGuid():N}") { Id = Guid.NewGuid(), CreatedAt = DateTime.UtcNow.AddDays(-1) };
        var newer = new Project(orgId, "B", $"b-{Guid.NewGuid():N}") { Id = Guid.NewGuid(), CreatedAt = DateTime.UtcNow };
        var otherOrg = NewProject(Guid.NewGuid(), "X", $"x-{Guid.NewGuid():N}");
        await sut.AddManyAsync([older, newer, otherOrg]);

        var list = (await sut.GetListAsync(orgId)).ToArray();

        Assert.Equal(2, list.Length);
        Assert.Equal(newer.Key, list[0].Key);
        Assert.Equal(older.Key, list[1].Key);
    }

    [DockerFact]
    public async Task AddWithEnvsAsync_PersistsProjectEnvironmentsAndBuiltInProperties()
    {
        var (sut, _, db) = NewServices();
        await using var _disposable = db;
        var orgId = Guid.NewGuid();
        var project = NewProject(orgId, "P", $"p-{Guid.NewGuid():N}");

        var result = await sut.AddWithEnvsAsync(project, ["Dev", "Prod"]);

        Assert.Equal(2, result.Environments.Count());
        var storedEnvs = await db.Set<Environment>()
            .Where(x => x.ProjectId == project.Id).ToListAsync();
        Assert.Equal(2, storedEnvs.Count);
        var props = await db.Set<EndUserProperty>()
            .Where(x => storedEnvs.Select(e => e.Id).Contains(x.EnvId)).CountAsync();
        Assert.True(props > 0);
    }
}

using Domain.EndUsers;
using Domain.Projects;
using Infrastructure.IntegrationTests.Fixtures;
using Infrastructure.Persistence.MongoDb;
using Infrastructure.Services.MongoDb;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using MongoDB.Driver;
using MongoDB.Driver.Linq;
using Environment = Domain.Environments.Environment;

namespace Infrastructure.IntegrationTests.Services.MongoDb;

[Collection(MongoCollection.Name)]
public class ProjectServiceTests : IntegrationTestBase
{
    private readonly MongoDbFixture _fixture;

    public ProjectServiceTests(MongoDbFixture fixture)
    {
        _fixture = fixture;
    }

    private (ProjectService project, EnvironmentService env, MongoDbClient client) NewServices()
    {
        var client = new MongoDbClient(Options.Create(new MongoDbOptions
        {
            ConnectionString = _fixture.ConnectionString,
            Database = $"be-proj-{Guid.NewGuid():N}"
        }));
        var envService = new EnvironmentService(client, NullLogger<EnvironmentService>.Instance);
        var projectService = new ProjectService(client, envService);
        return (projectService, envService, client);
    }

    [DockerFact]
    public async Task HasKeyBeenUsedAsync_KeyExistsInOrganization_ReturnsTrue()
    {
        var (sut, _, _) = NewServices();
        var orgId = Guid.NewGuid();
        await sut.AddOneAsync(new Project(orgId, "P", "Existing"));

        Assert.True(await sut.HasKeyBeenUsedAsync(orgId, "EXISTING"));
        Assert.False(await sut.HasKeyBeenUsedAsync(Guid.NewGuid(), "Existing"));
    }

    [DockerFact]
    public async Task GetWithEnvsAsync_ProjectWithEnvironments_ReturnsProjectAndEnvList()
    {
        var (sut, env, client) = NewServices();
        var orgId = Guid.NewGuid();
        var project = new Project(orgId, "P", "p");
        await sut.AddOneAsync(project);
        await env.AddManyWithBuiltInPropsAsync(
        [
            new Environment(project.Id, "Dev", "dev"),
            new Environment(project.Id, "Prod", "prod")
        ]);

        var result = await sut.GetWithEnvsAsync(project.Id);

        Assert.NotNull(result);
        Assert.Equal(project.Id, result!.Id);
        Assert.Equal(2, result.Environments.Count());
    }

    [DockerFact]
    public async Task GetWithEnvsAsync_UnknownProject_ReturnsNull()
    {
        var (sut, _, _) = NewServices();

        var result = await sut.GetWithEnvsAsync(Guid.NewGuid());

        Assert.Null(result);
    }

    [DockerFact]
    public async Task GetListAsync_ByOrganization_OrdersByCreatedAtDescending()
    {
        var (sut, _, _) = NewServices();
        var orgId = Guid.NewGuid();
        var older = new Project(orgId, "A", "a") { CreatedAt = DateTime.UtcNow.AddDays(-1) };
        var newer = new Project(orgId, "B", "b") { CreatedAt = DateTime.UtcNow };
        var otherOrg = new Project(Guid.NewGuid(), "X", "x");
        await sut.AddManyAsync([older, newer, otherOrg]);

        var list = (await sut.GetListAsync(orgId)).ToArray();

        Assert.Equal(2, list.Length);
        Assert.Equal("b", list[0].Key);
        Assert.Equal("a", list[1].Key);
    }

    [DockerFact]
    public async Task AddWithEnvsAsync_PersistsProjectEnvironmentsAndBuiltInProperties()
    {
        var (sut, _, client) = NewServices();
        var orgId = Guid.NewGuid();
        var project = new Project(orgId, "P", "p");

        var result = await sut.AddWithEnvsAsync(project, ["Dev", "Prod"]);

        Assert.Equal(2, result.Environments.Count());
        var storedEnvs = await client.QueryableOf<Environment>()
            .Where(x => x.ProjectId == project.Id).ToListAsync();
        Assert.Equal(2, storedEnvs.Count);
        var props = await client.QueryableOf<EndUserProperty>()
            .Where(x => storedEnvs.Select(e => e.Id).Contains(x.EnvId)).CountAsync();
        Assert.True(props > 0);
    }

    [DockerFact]
    public async Task DeleteAsync_DeletesProjectAndItsEnvironments()
    {
        var (sut, _, client) = NewServices();
        var project = new Project(Guid.NewGuid(), "P", "p");
        await sut.AddWithEnvsAsync(project, ["Dev"]);

        await sut.DeleteAsync(project.Id);

        Assert.False(await client.QueryableOf<Project>().AnyAsync(x => x.Id == project.Id));
        Assert.False(await client.QueryableOf<Environment>().AnyAsync(x => x.ProjectId == project.Id));
    }

    [DockerFact]
    public async Task DeleteManyAsync_DeletesAllListedProjectsAndTheirEnvironments()
    {
        var (sut, _, client) = NewServices();
        var p1 = new Project(Guid.NewGuid(), "1", "p1");
        var p2 = new Project(Guid.NewGuid(), "2", "p2");
        var keep = new Project(Guid.NewGuid(), "3", "keep");
        await sut.AddWithEnvsAsync(p1, ["Dev"]);
        await sut.AddWithEnvsAsync(p2, ["Dev"]);
        await sut.AddWithEnvsAsync(keep, ["Dev"]);

        await sut.DeleteManyAsync([p1.Id, p2.Id]);

        Assert.False(await client.QueryableOf<Project>().AnyAsync(x => x.Id == p1.Id || x.Id == p2.Id));
        Assert.True(await client.QueryableOf<Project>().AnyAsync(x => x.Id == keep.Id));
    }
}

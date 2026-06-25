using Domain.EndUsers;
using Domain.Organizations;
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
public class EnvironmentServiceTests : IntegrationTestBase
{
    private readonly MongoDbFixture _fixture;

    public EnvironmentServiceTests(MongoDbFixture fixture)
    {
        _fixture = fixture;
    }

    private (EnvironmentService env, MongoDbClient client) NewService()
    {
        var client = new MongoDbClient(Options.Create(new MongoDbOptions
        {
            ConnectionString = _fixture.ConnectionString,
            Database = $"be-env-{Guid.NewGuid():N}"
        }));
        return (new EnvironmentService(client, NullLogger<EnvironmentService>.Instance), client);
    }

    private static async Task<(Organization org, Project project, Environment env)> SeedHierarchyAsync(
        MongoDbClient client,
        string orgKey = "org",
        string projectKey = "proj",
        string envKey = "env")
    {
        var org = new Organization(Guid.NewGuid(), orgKey, orgKey) { Id = Guid.NewGuid() };
        var project = new Project(org.Id, projectKey, projectKey) { Id = Guid.NewGuid() };
        var env = new Environment(project.Id, envKey, envKey) { Id = Guid.NewGuid() };
        await client.CollectionOf<Organization>().InsertOneAsync(org);
        await client.CollectionOf<Project>().InsertOneAsync(project);
        await client.CollectionOf<Environment>().InsertOneAsync(env);
        return (org, project, env);
    }

    [DockerFact]
    public async Task HasKeyBeenUsedAsync_KeyExistsInProject_ReturnsTrue()
    {
        var (sut, _) = NewService();
        var projectId = Guid.NewGuid();
        await sut.AddOneAsync(new Environment(projectId, "Dev", "Dev"));

        Assert.True(await sut.HasKeyBeenUsedAsync(projectId, "dev"));
        Assert.False(await sut.HasKeyBeenUsedAsync(Guid.NewGuid(), "Dev"));
    }

    [DockerFact]
    public async Task GetProjectEnvAsync_KnownEnv_ReturnsProjectSlashEnvKey()
    {
        var (sut, client) = NewService();
        var (_, _, env) = await SeedHierarchyAsync(client, projectKey: "p", envKey: "e");

        var result = await sut.GetProjectEnvAsync(env.Id);

        Assert.Equal("p/e", result);
    }

    [DockerFact]
    public async Task GetProjectEnvAsync_UnknownEnv_ReturnsEmptyString()
    {
        var (sut, _) = NewService();

        Assert.Equal(string.Empty, await sut.GetProjectEnvAsync(Guid.NewGuid()));
    }

    [DockerFact]
    public async Task GetResourceDescriptorAsync_KnownEnv_ReturnsFullHierarchy()
    {
        var (sut, client) = NewService();
        var (org, project, env) = await SeedHierarchyAsync(client);

        var descriptor = await sut.GetResourceDescriptorAsync(env.Id);

        Assert.NotNull(descriptor);
        Assert.Equal(org.Id, descriptor!.Organization.Id);
        Assert.Equal(project.Id, descriptor.Project.Id);
        Assert.Equal(env.Id, descriptor.Environment.Id);
    }

    [DockerFact]
    public async Task GetResourceDescriptorAsync_UnknownEnv_ReturnsNull()
    {
        var (sut, _) = NewService();

        Assert.Null(await sut.GetResourceDescriptorAsync(Guid.NewGuid()));
    }

    [DockerFact]
    public async Task GetServesAsync_ReturnsEnvIdProjectNameAndEnvNameSerializedString()
    {
        var (sut, client) = NewService();
        var (_, project, env) = await SeedHierarchyAsync(client, projectKey: "p", envKey: "e");

        var serves = await sut.GetServesAsync([env.Id.ToString()]);

        var single = Assert.Single(serves);
        Assert.Equal($"{env.Id},{project.Name}/{env.Name}", single);
    }

    [DockerFact]
    public async Task GetServesAsync_EmptyScopes_ReturnsEmpty()
    {
        var (sut, _) = NewService();

        Assert.Empty(await sut.GetServesAsync([]));
    }

    [DockerFact]
    public async Task AddWithBuiltInPropsAsync_InsertsEnvironmentAndBuiltInProperties()
    {
        var (sut, client) = NewService();
        var env = new Environment(Guid.NewGuid(), "Dev", "dev");

        await sut.AddWithBuiltInPropsAsync(env);

        Assert.True(await client.QueryableOf<Environment>().AnyAsync(x => x.Id == env.Id));
        Assert.True(await client.QueryableOf<EndUserProperty>().AnyAsync(x => x.EnvId == env.Id));
    }

    [DockerFact]
    public async Task DeleteAsync_RemovesEnvironmentAndItsEndUserData()
    {
        var (sut, client) = NewService();
        var env = new Environment(Guid.NewGuid(), "Dev", "dev");
        await sut.AddWithBuiltInPropsAsync(env);

        await sut.DeleteAsync(env.Id);

        Assert.False(await client.QueryableOf<Environment>().AnyAsync(x => x.Id == env.Id));
        Assert.False(await client.QueryableOf<EndUserProperty>().AnyAsync(x => x.EnvId == env.Id));
    }

    [DockerFact]
    public async Task DeleteManyAsync_RemovesAllListedEnvironments()
    {
        var (sut, client) = NewService();
        var e1 = new Environment(Guid.NewGuid(), "1", "e1");
        var e2 = new Environment(Guid.NewGuid(), "2", "e2");
        var keep = new Environment(Guid.NewGuid(), "k", "keep");
        await sut.AddWithBuiltInPropsAsync(e1);
        await sut.AddWithBuiltInPropsAsync(e2);
        await sut.AddWithBuiltInPropsAsync(keep);

        await sut.DeleteManyAsync([e1.Id, e2.Id]);

        Assert.False(await client.QueryableOf<Environment>().AnyAsync(x => x.Id == e1.Id || x.Id == e2.Id));
        Assert.True(await client.QueryableOf<Environment>().AnyAsync(x => x.Id == keep.Id));
    }
}

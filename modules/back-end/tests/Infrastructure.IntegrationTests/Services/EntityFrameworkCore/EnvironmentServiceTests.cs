using Domain.EndUsers;
using Domain.Organizations;
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
public class EnvironmentServiceTests : IntegrationTestBase
{
    private readonly FeatBitPostgresFixture _fixture;

    public EnvironmentServiceTests(FeatBitPostgresFixture fixture)
    {
        _fixture = fixture;
    }

    private (EnvironmentService Service, AppDbContext Db) NewService()
    {
        var db = AppDbContextFactory.Create(_fixture.ConnectionString);
        return (new EnvironmentService(db, NullLogger<EnvironmentService>.Instance), db);
    }

    private static async Task<(Organization Org, Project Project, Environment Env)> SeedHierarchyAsync(
        AppDbContext db,
        string? orgKey = null,
        string? projectKey = null,
        string? envKey = null)
    {
        var workspaceId = Guid.NewGuid();
        var org = new Organization(workspaceId, orgKey ?? $"org-{Guid.NewGuid():N}", orgKey ?? $"org-{Guid.NewGuid():N}")
        {
            Id = Guid.NewGuid()
        };
        var project = new Project(org.Id, projectKey ?? "proj", projectKey ?? $"proj-{Guid.NewGuid():N}")
        {
            Id = Guid.NewGuid()
        };
        var env = new Environment(project.Id, envKey ?? "env", envKey ?? $"env-{Guid.NewGuid():N}")
        {
            Id = Guid.NewGuid()
        };
        db.Set<Organization>().Add(org);
        db.Set<Project>().Add(project);
        db.Set<Environment>().Add(env);
        await db.SaveChangesAsync();
        return (org, project, env);
    }

    [DockerFact]
    public async Task HasKeyBeenUsedAsync_KeyExistsInProject_ReturnsTrue()
    {
        var (sut, db) = NewService();
        await using var _ = db;
        var projectId = Guid.NewGuid();
        await sut.AddOneAsync(new Environment(projectId, "Dev", "Dev") { Id = Guid.NewGuid() });

        Assert.True(await sut.HasKeyBeenUsedAsync(projectId, "dev"));
        Assert.False(await sut.HasKeyBeenUsedAsync(Guid.NewGuid(), "Dev"));
    }

    [DockerFact]
    public async Task GetProjectEnvAsync_KnownEnv_ReturnsProjectSlashEnvKey()
    {
        var (sut, db) = NewService();
        await using var _ = db;
        var (_, project, env) = await SeedHierarchyAsync(db, projectKey: $"p-{Guid.NewGuid():N}", envKey: $"e-{Guid.NewGuid():N}");

        var result = await sut.GetProjectEnvAsync(env.Id);

        Assert.Equal($"{project.Key}/{env.Key}", result);
    }

    [DockerFact]
    public async Task GetProjectEnvAsync_UnknownEnv_ReturnsEmptyString()
    {
        var (sut, db) = NewService();
        await using var _ = db;

        Assert.Equal(string.Empty, await sut.GetProjectEnvAsync(Guid.NewGuid()));
    }

    [DockerFact]
    public async Task GetResourceDescriptorAsync_KnownEnv_ReturnsFullHierarchy()
    {
        var (sut, db) = NewService();
        await using var _ = db;
        var (org, project, env) = await SeedHierarchyAsync(db);

        var descriptor = await sut.GetResourceDescriptorAsync(env.Id);

        Assert.NotNull(descriptor);
        Assert.Equal(org.Id, descriptor!.Organization.Id);
        Assert.Equal(project.Id, descriptor.Project.Id);
        Assert.Equal(env.Id, descriptor.Environment.Id);
    }

    [DockerFact]
    public async Task GetResourceDescriptorAsync_UnknownEnv_ReturnsNull()
    {
        var (sut, db) = NewService();
        await using var _ = db;

        Assert.Null(await sut.GetResourceDescriptorAsync(Guid.NewGuid()));
    }

    [DockerFact]
    public async Task GetServesAsync_ReturnsEnvIdProjectNameAndEnvNameSerializedString()
    {
        var (sut, db) = NewService();
        await using var _ = db;
        var (_, project, env) = await SeedHierarchyAsync(db, projectKey: $"p-{Guid.NewGuid():N}", envKey: $"e-{Guid.NewGuid():N}");

        var serves = await sut.GetServesAsync([env.Id.ToString()]);

        var single = Assert.Single(serves);
        Assert.Equal($"{env.Id},{project.Name}/{env.Name}", single);
    }

    [DockerFact]
    public async Task GetServesAsync_EmptyScopes_ReturnsEmpty()
    {
        var (sut, db) = NewService();
        await using var _ = db;

        Assert.Empty(await sut.GetServesAsync([]));
    }

    [DockerFact]
    public async Task GetRpSecretsAsync_EmptyEnvIds_ReturnsEmpty()
    {
        var (sut, db) = NewService();
        await using var _ = db;

        Assert.Empty(await sut.GetRpSecretsAsync([]));
    }

    [DockerFact]
    public async Task AddWithBuiltInPropsAsync_InsertsEnvironmentAndBuiltInProperties()
    {
        var (sut, db) = NewService();
        await using var _ = db;
        var env = new Environment(Guid.NewGuid(), "Dev", $"dev-{Guid.NewGuid():N}") { Id = Guid.NewGuid() };

        await sut.AddWithBuiltInPropsAsync(env);

        Assert.True(await db.Set<Environment>().AnyAsync(x => x.Id == env.Id));
        Assert.True(await db.Set<EndUserProperty>().AnyAsync(x => x.EnvId == env.Id));
    }
}

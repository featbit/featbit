using Application.Services;
using Domain.FeatureFlags;
using Domain.Organizations;
using Domain.Projects;
using Domain.Resources;
using Domain.Segments;
using Infrastructure.IntegrationTests.Fixtures;
using Infrastructure.Persistence.MongoDb;
using Microsoft.Extensions.Options;
using Environment = Domain.Environments.Environment;

namespace Infrastructure.IntegrationTests.Services;

internal sealed class ResourceOwnershipData
{
    public Organization Organization { get; } = new(Guid.NewGuid(), "Org", "org") { Id = Guid.NewGuid() };
    public Project Project { get; }
    public Environment Environment { get; }
    public FeatureFlag Flag { get; }
    public Segment Local { get; }
    public Segment Shared { get; }
    public ResourceOwnershipData()
    {
        Project = new(Organization.Id, "Project", "project") { Id = Guid.NewGuid() };
        Environment = new(Project.Id, "Env", "env") { Id = Guid.NewGuid() };
        Flag = new(Environment.Id, "Flag", "", "flag", false, VariationTypes.Boolean,
            [new() { Id = "off", Value = "false" }, new() { Id = "on", Value = "true" }],
            "off", "on", ["tag"], Guid.NewGuid()) { Id = Guid.NewGuid() };
        Local = new(Organization.WorkspaceId, Environment.Id, "Local", "local", SegmentType.EnvironmentSpecific, [], [], [], [], "")
        { Id = Guid.NewGuid(), Tags = ["tag"] };
        Shared = new(Organization.WorkspaceId, Guid.NewGuid(), "Shared", "shared", SegmentType.Shared,
            ["organization/org:project/project:env/env"], [], [], [], "") { Id = Guid.NewGuid() };
    }

    public async Task AssertOwnership(IResourceService service)
    {
        Assert.Equal(new ResourceRn("project/project", Organization.Id), await service.GetProjectRnAsync(Project.Id));
        Assert.Equal(new ResourceRn("project/project:env/env", Organization.Id), await service.GetEnvRnAsync(Environment.Id));
        Assert.Equal(new ResourceRn("project/project:env/env:flag/flag;tag", Organization.Id), await service.GetFlagRnAsync(Environment.Id, Flag.Key));
        Assert.Equal(new ResourceRn("project/project:env/env:segment/local;tag", Organization.Id), await service.GetSegmentRnAsync(Environment.Id, Local.Id));
        Assert.Equal(new ResourceRn("project/project:env/env:segment/shared", Organization.Id), await service.GetSegmentRnAsync(Environment.Id, Shared.Id));
        Assert.Null(await service.GetProjectRnAsync(Guid.NewGuid()));
        Assert.Null(await service.GetEnvRnAsync(Guid.NewGuid()));
        Assert.Null(await service.GetFlagRnAsync(Guid.NewGuid(), Flag.Key));
        Assert.Null(await service.GetSegmentRnAsync(Guid.NewGuid(), Local.Id));
        Assert.Null(await service.GetSegmentRnAsync(Guid.NewGuid(), Shared.Id));
    }
}

[Collection(FeatBitPostgresCollection.Name)]
public class PostgresResourceOwnershipTests(FeatBitPostgresFixture fixture) : IntegrationTestBase
{
    [DockerFact]
    public async Task ResourceRnsIncludeOwningOrganizationAndSharedSegmentAccessContext()
    {
        await using var db = AppDbContextFactory.Create(fixture.ConnectionString);
        var data = new ResourceOwnershipData();
        db.AddRange(data.Organization, data.Project, data.Environment, data.Flag, data.Local, data.Shared);
        await db.SaveChangesAsync();
        await data.AssertOwnership(new Infrastructure.Services.EntityFrameworkCore.ResourceService(db));
    }
}

[Collection(MongoCollection.Name)]
public class MongoResourceOwnershipTests(MongoDbFixture fixture) : IntegrationTestBase
{
    [DockerFact]
    public async Task ResourceRnsIncludeOwningOrganizationAndSharedSegmentAccessContext()
    {
        var db = new MongoDbClient(Options.Create(new MongoDbOptions
        { ConnectionString = fixture.ConnectionString, Database = $"resource-ownership-{Guid.NewGuid():N}" }));
        var data = new ResourceOwnershipData();
        await db.CollectionOf<Organization>().InsertOneAsync(data.Organization);
        await db.CollectionOf<Project>().InsertOneAsync(data.Project);
        await db.CollectionOf<Environment>().InsertOneAsync(data.Environment);
        await db.CollectionOf<FeatureFlag>().InsertOneAsync(data.Flag);
        await db.CollectionOf<Segment>().InsertManyAsync([data.Local, data.Shared]);
        await data.AssertOwnership(new Infrastructure.Services.MongoDb.ResourceService(db));
    }
}

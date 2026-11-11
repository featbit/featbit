using Application.Services;
using Domain.FeatureFlags;
using Domain.Organizations;
using Domain.Projects;
using Domain.Resources;
using Domain.Segments;
using Infrastructure.IntegrationTests.Fixtures;
using Infrastructure.Persistence.MongoDb;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Logging.Abstractions;
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
    public Organization ForeignOrganization { get; }
    public Project ForeignProject { get; }
    public Environment ForeignEnvironment { get; }
    public Organization SharedOrganization { get; }
    public Project SharedProject { get; }
    public Environment SharedEnvironment { get; }
    public Segment ForeignLocal { get; }
    public Segment ForeignShared { get; }
    public ResourceOwnershipData()
    {
        ForeignOrganization = new(Guid.NewGuid(), "Foreign", "org") { Id = Guid.NewGuid() };
        ForeignProject = new(ForeignOrganization.Id, "Project", "project") { Id = Guid.NewGuid() };
        ForeignEnvironment = new(ForeignProject.Id, "Env", "env") { Id = Guid.NewGuid() };
        SharedOrganization = new(Organization.WorkspaceId, "Shared Org", "shared-org") { Id = Guid.NewGuid() };
        SharedProject = new(SharedOrganization.Id, "Project", "project") { Id = Guid.NewGuid() };
        SharedEnvironment = new(SharedProject.Id, "Env", "env") { Id = Guid.NewGuid() };
        Project = new(Organization.Id, "Project", "project") { Id = Guid.NewGuid() };
        Environment = new(Project.Id, "Env", "env") { Id = Guid.NewGuid() };
        Flag = new(Environment.Id, "Flag", "", "flag", false, VariationTypes.Boolean,
            [new() { Id = "off", Value = "false" }, new() { Id = "on", Value = "true" }],
            "off", "on", ["tag"], Guid.NewGuid()) { Id = Guid.NewGuid() };
        Local = new(Organization.WorkspaceId, Environment.Id, "Local", "local", SegmentType.EnvironmentSpecific, [], [], [], [], "")
        { Id = Guid.NewGuid(), Tags = ["tag"] };
        Shared = new(Organization.WorkspaceId, Guid.NewGuid(), "Shared", "shared", SegmentType.Shared,
            ["organization/org:project/project:env/env", "organization/shared-org"], [], [], [], "") { Id = Guid.NewGuid() };
        ForeignShared = new(ForeignOrganization.WorkspaceId, ForeignEnvironment.Id, "Foreign shared", "foreign-shared",
            SegmentType.Shared, ["organization/org:project/project:env/env"], [], [], [], "") { Id = Guid.NewGuid() };
        ForeignLocal = new(ForeignOrganization.WorkspaceId, Environment.Id, "Foreign local", "foreign-local",
            SegmentType.EnvironmentSpecific, [], [], [], [], "") { Id = Guid.NewGuid() };
    }

    public async Task AssertOwnership(IResourceService service)
    {
        Assert.Equal(new ResourceRn("project/project", Organization.Id), await service.GetProjectRnAsync(Project.Id));
        Assert.Equal(new ResourceRn("project/project:env/env", Organization.Id), await service.GetEnvRnAsync(Environment.Id));
        Assert.Equal(new ResourceRn("project/project:env/env:flag/flag;tag", Organization.Id), await service.GetFlagRnAsync(Environment.Id, Flag.Key));
        Assert.Equal(new ResourceRn("project/project:env/env:segment/local;tag", Organization.Id), await service.GetSegmentRnAsync(Environment.Id, Local.Id));
        Assert.Equal(new ResourceRn("project/project:env/env:segment/shared", Organization.Id), await service.GetSegmentRnAsync(Environment.Id, Shared.Id));
        Assert.Null(await service.GetSegmentRnAsync(ForeignEnvironment.Id, Shared.Id));
        Assert.Null(await service.GetSegmentRnAsync(Environment.Id, ForeignLocal.Id));
        Assert.Null(await service.GetSegmentRnAsync(SharedEnvironment.Id, Local.Id));
        Assert.Equal(new ResourceRn("project/project:env/env:segment/shared", SharedOrganization.Id),
            await service.GetSegmentRnAsync(SharedEnvironment.Id, Shared.Id));
        Assert.Null(await service.GetProjectRnAsync(Guid.NewGuid()));
        Assert.Null(await service.GetEnvRnAsync(Guid.NewGuid()));
        Assert.Null(await service.GetFlagRnAsync(Guid.NewGuid(), Flag.Key));
        Assert.Null(await service.GetSegmentRnAsync(Guid.NewGuid(), Local.Id));
        Assert.Null(await service.GetSegmentRnAsync(Guid.NewGuid(), Shared.Id));
    }
    public async Task AssertScopeExpansion(ISegmentService service)
    {
        var ids = await service.GetEnvironmentIdsAsync(Shared);
        Assert.Equal(new[] { Environment.Id, SharedEnvironment.Id }.Order(), ids.Order());
        var caches = await service.GetCachesAsync();
        var sharedCache = Assert.Single(caches, x => x.Segment.Id == Shared.Id);
        Assert.Equal(ids.Order(), sharedCache.EnvIds.Order());
        Assert.DoesNotContain(ForeignEnvironment.Id, sharedCache.EnvIds);
        var foreignCache = Assert.Single(caches, x => x.Segment.Id == ForeignShared.Id);
        Assert.Equal(new[] { ForeignEnvironment.Id }, foreignCache.EnvIds);
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
        db.AddRange(data.Organization, data.Project, data.Environment, data.Flag, data.Local, data.Shared, data.ForeignShared, data.ForeignLocal, data.ForeignOrganization, data.ForeignProject, data.ForeignEnvironment, data.SharedOrganization, data.SharedProject, data.SharedEnvironment);
        await db.SaveChangesAsync();
        await data.AssertOwnership(new Infrastructure.Services.EntityFrameworkCore.ResourceService(db));
        await data.AssertScopeExpansion(new Infrastructure.Services.EntityFrameworkCore.SegmentService(db,
            NullLogger<Infrastructure.Services.EntityFrameworkCore.SegmentService>.Instance));
    }
}

[Collection(MongoCollection.Name)]
public class MongoResourceOwnershipTests(MongoDbFixture fixture) : IntegrationTestBase
{
    [DockerFact]
    public async Task SharedCachesHandleRepeatedAndOverlappingScopesWithinEachWorkspace()
    {
        var db = new MongoDbClient(Options.Create(new MongoDbOptions
        { ConnectionString = fixture.ConnectionString, Database = $"scope-cache-{Guid.NewGuid():N}" }));
        var data = new ResourceOwnershipData();
        data.Shared.Scopes = [data.Shared.Scopes[0], data.Shared.Scopes[0], "organization/org", "organization/shared-org"];
        var repeated = new Segment(data.Organization.WorkspaceId, data.Environment.Id, "Repeated", "repeated",
            SegmentType.Shared, data.Shared.Scopes, [], [], [], "") { Id = Guid.NewGuid() };
        var empty = new Segment(data.Organization.WorkspaceId, data.Environment.Id, "Empty", "empty",
            SegmentType.Shared, [], [], [], [], "") { Id = Guid.NewGuid() };
        await db.CollectionOf<Organization>().InsertManyAsync([data.Organization, data.ForeignOrganization, data.SharedOrganization]);
        await db.CollectionOf<Project>().InsertManyAsync([data.Project, data.ForeignProject, data.SharedProject]);
        await db.CollectionOf<Environment>().InsertManyAsync([data.Environment, data.ForeignEnvironment, data.SharedEnvironment]);
        await db.CollectionOf<Segment>().InsertManyAsync([data.Local, data.Shared, data.ForeignShared, repeated, empty]);
        var service = new Infrastructure.Services.MongoDb.SegmentService(db,
            NullLogger<Infrastructure.Services.MongoDb.SegmentService>.Instance);

        var caches = await service.GetCachesAsync();

        Assert.Equal(5, caches.Count);
        foreach (var segment in new[] { data.Shared, repeated })
        {
            var cache = Assert.Single(caches, x => x.Segment.Id == segment.Id);
            Assert.Equal(new[] { data.Environment.Id, data.SharedEnvironment.Id }.Order(), cache.EnvIds.Order());
        }
        Assert.Equal(new[] { data.ForeignEnvironment.Id }, Assert.Single(caches, x => x.Segment.Id == data.ForeignShared.Id).EnvIds);
        Assert.Equal(new[] { data.Environment.Id }, Assert.Single(caches, x => x.Segment.Id == data.Local.Id).EnvIds);
        Assert.Empty(Assert.Single(caches, x => x.Segment.Id == empty.Id).EnvIds);
    }

    [DockerFact]
    public async Task ResourceRnsIncludeOwningOrganizationAndSharedSegmentAccessContext()
    {
        var db = new MongoDbClient(Options.Create(new MongoDbOptions
        { ConnectionString = fixture.ConnectionString, Database = $"resource-ownership-{Guid.NewGuid():N}" }));
        var data = new ResourceOwnershipData();
        await db.CollectionOf<Organization>().InsertManyAsync([data.Organization, data.ForeignOrganization, data.SharedOrganization]);
        await db.CollectionOf<Project>().InsertManyAsync([data.Project, data.ForeignProject, data.SharedProject]);
        await db.CollectionOf<Environment>().InsertManyAsync([data.Environment, data.ForeignEnvironment, data.SharedEnvironment]);
        await db.CollectionOf<FeatureFlag>().InsertOneAsync(data.Flag);
        await db.CollectionOf<Segment>().InsertManyAsync([data.Local, data.Shared, data.ForeignShared, data.ForeignLocal]);
        await data.AssertOwnership(new Infrastructure.Services.MongoDb.ResourceService(db));
        await data.AssertScopeExpansion(new Infrastructure.Services.MongoDb.SegmentService(db,
            NullLogger<Infrastructure.Services.MongoDb.SegmentService>.Instance));
    }
}

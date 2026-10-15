using Domain.Organizations;
using Domain.Projects;
using Domain.Segments;
using Infrastructure.IntegrationTests.Fixtures;
using Infrastructure.Persistence.MongoDb;
using Infrastructure.Services.MongoDb;
using Microsoft.Extensions.Options;
using Environment = Domain.Environments.Environment;

namespace Infrastructure.IntegrationTests.Services.MongoDb;

[Collection(MongoCollection.Name)]
public class ResourceServiceTests(MongoDbFixture fixture) : IntegrationTestBase
{
    [DockerFact]
    public async Task Ownership_CollidingProjectAndEnvironmentKeys_UsesRealOrganizationIds()
    {
        var data = new ResourceOrganizationScenario();
        var db = await SeedAsync(data);
        var service = new ResourceService(db);

        Assert.Equal(await service.GetEnvRnAsync(data.FirstEnv.Id), await service.GetEnvRnAsync(data.SecondEnv.Id));
        Assert.True(await service.IsProjectInOrganizationAsync(data.FirstOrganization.Id, data.FirstProject.Id));
        Assert.False(await service.IsProjectInOrganizationAsync(data.FirstOrganization.Id, data.SecondProject.Id));
        Assert.True(await service.IsEnvInOrganizationAsync(data.FirstOrganization.Id, data.FirstEnv.Id, data.FirstProject.Id));
        Assert.False(await service.IsEnvInOrganizationAsync(data.FirstOrganization.Id, data.SecondEnv.Id));
        Assert.False(await service.IsEnvInOrganizationAsync(data.FirstOrganization.Id, data.FirstEnv.Id, data.SecondProject.Id));
        Assert.Equal(data.FirstOrganization.WorkspaceId, await service.GetOrganizationWorkspaceIdAsync(data.FirstOrganization.Id));
        Assert.True(await service.SegmentExistsAsync(data.SharedSegment.Id));
        Assert.False(await service.SegmentExistsAsync(Guid.NewGuid()));
    }

    [DockerTheory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task GetSegmentRnAsync_SharedScope_IsConfinedToItsWorkspace(bool sameWorkspace)
    {
        var data = new ResourceOrganizationScenario(sameWorkspace);
        var db = await SeedAsync(data);
        var service = new ResourceService(db);

        Assert.NotNull(await service.GetSegmentRnAsync(data.FirstEnv.Id, data.SharedSegment.Id));
        var second = await service.GetSegmentRnAsync(data.SecondEnv.Id, data.SharedSegment.Id);
        Assert.Equal(sameWorkspace, second != null);
    }

    private async Task<MongoDbClient> SeedAsync(ResourceOrganizationScenario data)
    {
        var db = new MongoDbClient(Options.Create(new MongoDbOptions
        {
            ConnectionString = fixture.ConnectionString,
            Database = "resource-scope-" + Guid.NewGuid().ToString("N")
        }));
        await db.CollectionOf<Organization>().InsertManyAsync([data.FirstOrganization, data.SecondOrganization]);
        await db.CollectionOf<Project>().InsertManyAsync([data.FirstProject, data.SecondProject]);
        await db.CollectionOf<Environment>().InsertManyAsync([data.FirstEnv, data.SecondEnv]);
        await db.CollectionOf<Segment>().InsertOneAsync(data.SharedSegment);
        return db;
    }
}

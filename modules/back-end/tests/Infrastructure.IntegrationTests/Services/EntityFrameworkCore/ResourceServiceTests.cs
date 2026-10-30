using Domain.Organizations;
using Domain.Projects;
using Domain.Segments;
using Infrastructure.IntegrationTests.Fixtures;
using Infrastructure.Persistence.EntityFrameworkCore;
using Infrastructure.Services.EntityFrameworkCore;
using Environment = Domain.Environments.Environment;

namespace Infrastructure.IntegrationTests.Services.EntityFrameworkCore;

[Collection(FeatBitPostgresCollection.Name)]
public class ResourceServiceTests(FeatBitPostgresFixture fixture) : IntegrationTestBase
{
    [DockerFact]
    public async Task Ownership_CollidingProjectAndEnvironmentKeys_UsesRealOrganizationIds()
    {
        var data = new ResourceOrganizationScenario();
        await using var db = AppDbContextFactory.Create(fixture.ConnectionString);
        await SeedAsync(db, data);
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
        await using var db = AppDbContextFactory.Create(fixture.ConnectionString);
        await SeedAsync(db, data);
        var service = new ResourceService(db);

        Assert.NotNull(await service.GetSegmentRnAsync(data.FirstEnv.Id, data.SharedSegment.Id));
        var second = await service.GetSegmentRnAsync(data.SecondEnv.Id, data.SharedSegment.Id);
        Assert.Equal(sameWorkspace, second != null);
    }

    private static async Task SeedAsync(AppDbContext db, ResourceOrganizationScenario data)
    {
        db.Set<Organization>().AddRange(data.FirstOrganization, data.SecondOrganization);
        db.Set<Project>().AddRange(data.FirstProject, data.SecondProject);
        db.Set<Environment>().AddRange(data.FirstEnv, data.SecondEnv);
        db.Set<Segment>().Add(data.SharedSegment);
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
    }
}

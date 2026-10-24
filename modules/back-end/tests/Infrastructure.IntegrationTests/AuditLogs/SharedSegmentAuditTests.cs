using Application.AuditLogs;
using Application.Services;
using Domain.AuditLogs;
using Domain.Organizations;
using Domain.Projects;
using Domain.Segments;
using Infrastructure.IntegrationTests.Fixtures;
using Infrastructure.IntegrationTests.Support;
using Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Moq;
using Environment = Domain.Environments.Environment;

namespace Infrastructure.IntegrationTests.AuditLogs;

[Collection(FeatBitPostgresCollection.Name)]
public class SharedSegmentAuditTests(FeatBitPostgresFixture fixture) : IntegrationTestBase
{
    [DockerFact]
    public async Task Writes_PreserveOriginalEnvironment_WithoutLosingCrossEnvironmentHistory()
    {
        await using var db = AppDbContextFactory.Create(fixture.ConnectionString);
        var org = new Organization(Guid.NewGuid(), "Audit", "audit") { Id = Guid.NewGuid() };
        var project = new Project(org.Id, "Project", "project") { Id = Guid.NewGuid() };
        var env = new Environment(project.Id, "Origin", "origin");
        db.AddRange(org, project, env);
        await db.SaveChangesAsync();
        var environments = new Infrastructure.Services.EntityFrameworkCore.EnvironmentService(db,
            Microsoft.Extensions.Logging.Abstractions.NullLogger<Infrastructure.Services.EntityFrameworkCore.EnvironmentService>.Instance);
        var owner = await environments.GetOrganizationAsync(env.Id);
        Assert.Equal(org.Id, owner.Id);
        Assert.Equal(org.WorkspaceId, owner.WorkspaceId);
        var service = new Infrastructure.Services.EntityFrameworkCore.AuditLogService(db);
        var segment = new Segment(org.WorkspaceId, env.Id, "Shared", "shared", SegmentType.Shared, [], [], [], [], "")
            { Id = Guid.NewGuid() };
        var logs = new[]
        {
            AuditLog.For(segment, org.WorkspaceId, org.Id, Operations.Create, new DataChange(null).To(segment), "", Guid.NewGuid()),
            AuditLog.For(segment, org.WorkspaceId, org.Id, Operations.Update, new DataChange(segment).To(segment), "changed", Guid.NewGuid()),
            AuditLog.For(segment, org.WorkspaceId, org.Id, Operations.Remove, new DataChange(segment).To(null), "deleted", Guid.NewGuid())
        };
        await service.AddManyAsync(logs);
        var originalPage = await service.GetListAsync(org.WorkspaceId, org.Id, env.Id, new AuditLogFilter { Scope = AuditLogScope.Environment });
        Assert.Equal(3, originalPage.TotalCount);
        Assert.All(originalPage.Items, x =>
        {
            Assert.Equal(org.WorkspaceId, x.WorkspaceId);
            Assert.Equal(env.Id, x.EnvId);
            Assert.Null(x.OrganizationId);
        });
        Assert.NotNull(await service.GetLastChangeAsync(org.WorkspaceId, env.Id, "Segment", segment.Id.ToString()));
        Assert.Single(await service.GetLastChangesAsync(org.WorkspaceId, env.Id, "Segment", [segment.Id.ToString()]));
        Assert.Empty(await service.GetLastChangesAsync(Guid.NewGuid(), env.Id, "Segment", [segment.Id.ToString()]));
        var otherEnv = Guid.NewGuid();
        Assert.Empty((await service.GetListAsync(org.WorkspaceId, org.Id, otherEnv, new AuditLogFilter { Scope = AuditLogScope.Environment })).Items);
        var history = await service.GetListAsync(org.WorkspaceId, org.Id, otherEnv, new AuditLogFilter { Scope = AuditLogScope.Environment, CrossEnvironment = true, RefType = "Segment", RefId = segment.Id.ToString() });
        Assert.Equal(logs.Select(x => x.Id).Order(), history.Items.Select(x => x.Id).Order());
        Assert.Empty((await service.GetListAsync(Guid.NewGuid(), org.Id, env.Id, new AuditLogFilter { Scope = AuditLogScope.Environment, CrossEnvironment = true, RefId = segment.Id.ToString() })).Items);
    }
}

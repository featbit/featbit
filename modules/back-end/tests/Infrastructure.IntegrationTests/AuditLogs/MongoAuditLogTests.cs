using Application.AuditLogs;
using Domain.AuditLogs;
using Domain.Organizations;
using Domain.Projects;
using Domain.Segments;
using Infrastructure.IntegrationTests.Fixtures;
using Infrastructure.Persistence.MongoDb;
using Infrastructure.Services.MongoDb;
using Microsoft.Extensions.Options;
using MongoDB.Driver;
using Environment = Domain.Environments.Environment;

namespace Infrastructure.IntegrationTests.AuditLogs;

[Collection(MongoCollection.Name)]
public class MongoAuditLogTests(MongoDbFixture fixture) : IntegrationTestBase
{
    [DockerFact]
    public async Task CrossEnvironment_IsolatesTenants_IncludingLegacyRecords_CountsAndPaging()
    {
        var client = new MongoDbClient(Options.Create(new MongoDbOptions
        { ConnectionString = fixture.ConnectionString, Database = $"audit-{Guid.NewGuid():N}" }));
        var service = new AuditLogService(client);
        var org = new Organization(Guid.NewGuid(), "Own", "own") { Id = Guid.NewGuid() };
        var otherOrg = new Organization(Guid.NewGuid(), "Other", "other") { Id = Guid.NewGuid() };
        var project = new Project(org.Id, "Own", "own") { Id = Guid.NewGuid() };
        var otherProject = new Project(otherOrg.Id, "Other", "other") { Id = Guid.NewGuid() };
        var env = new Environment(project.Id, "Own", "own");
        var secondEnv = new Environment(project.Id, "Second", "second");
        var foreignEnv = new Environment(otherProject.Id, "Foreign", "foreign");
        await client.CollectionOf<Organization>().InsertManyAsync([org, otherOrg]);
        await client.CollectionOf<Project>().InsertManyAsync([project, otherProject]);
        await client.CollectionOf<Environment>().InsertManyAsync([env, secondEnv, foreignEnv]);
        AuditLog Log(Guid? environment, Guid workspace, string type = AuditLogRefTypes.FeatureFlag) =>
            new(environment, Guid.NewGuid().ToString(), type, "entry", Operations.Create,
                new DataChange(null).To(new { Name = "entry" }), "", Guid.NewGuid()) { Id = Guid.NewGuid(), WorkspaceId = workspace };
        var missingOwner = Log(env.Id, Guid.Empty);
        var emptyOwner = Log(secondEnv.Id, Guid.Empty);
        var explicitOwner = Log(secondEnv.Id, org.WorkspaceId);
        var foreignMissing = Log(foreignEnv.Id, Guid.Empty);
        var foreignExplicit = Log(foreignEnv.Id, otherOrg.WorkspaceId);
        var conflictingOwner = Log(env.Id, otherOrg.WorkspaceId);
        var orphan = Log(Guid.NewGuid(), Guid.Empty);
        var iam = Log(null, org.WorkspaceId, AuditLogRefTypes.Group);
        await service.AddManyAsync([missingOwner, emptyOwner, explicitOwner, foreignMissing, foreignExplicit, conflictingOwner, orphan, iam]);
        foreach (var entry in new[] { missingOwner, foreignMissing })
            await client.CollectionOf<AuditLog>().UpdateOneAsync(x => x.Id == entry.Id,
                Builders<AuditLog>.Update.Unset(x => x.WorkspaceId));
        var filter = new AuditLogFilter { EnvId = env.Id, CrossEnvironment = true, PageSize = 1 };
        var ids = new List<Guid>();
        for (var page = 0; page < 3; page++)
        {
            filter.PageIndex = page;
            var result = await service.GetListAsync(org.WorkspaceId, filter);
            Assert.Equal(3, result.TotalCount);
            ids.Add(Assert.Single(result.Items).Id);
        }
        Assert.Equal(new[] { missingOwner.Id, emptyOwner.Id, explicitOwner.Id }.Order(), ids.Order());
        Assert.Equal(missingOwner.Id, Assert.Single((await service.GetListAsync(org.WorkspaceId,
            new AuditLogFilter { EnvId = env.Id })).Items).Id);
        Assert.Empty((await service.GetListAsync(org.WorkspaceId,
            new AuditLogFilter { EnvId = env.Id, CrossEnvironment = true, RefId = foreignExplicit.RefId })).Items);
        Assert.Empty((await service.GetListAsync(org.WorkspaceId,
            new AuditLogFilter { EnvId = env.Id, CrossEnvironment = true, RefType = "Group" })).Items);
    }

    [DockerFact]
    public async Task SharedSegment_AppearsInOriginalEnvironment_AndCrossEnvironmentResourceHistory()
    {
        var client = new MongoDbClient(Options.Create(new MongoDbOptions
        { ConnectionString = fixture.ConnectionString, Database = $"audit-shared-{Guid.NewGuid():N}" }));
        var service = new AuditLogService(client);
        var workspaceId = Guid.NewGuid();
        var envId = Guid.NewGuid();
        var segment = new Segment(workspaceId, envId, "Shared", "shared", SegmentType.Shared, [], [], [], [], "") { Id = Guid.NewGuid() };
        var log = AuditLog.For(segment, Operations.Update, new DataChange(null).To(segment), "changed", Guid.NewGuid());
        await service.AddOneAsync(log);
        Assert.Equal(envId, log.EnvId);
        Assert.Equal(log.Id, Assert.Single((await service.GetListAsync(workspaceId,
            new AuditLogFilter { EnvId = envId })).Items).Id);
        var otherEnv = Guid.NewGuid();
        Assert.Empty((await service.GetListAsync(workspaceId, new AuditLogFilter { EnvId = otherEnv })).Items);
        Assert.Equal(log.Id, Assert.Single((await service.GetListAsync(workspaceId,
            new AuditLogFilter { EnvId = otherEnv, CrossEnvironment = true, RefType = "Segment", RefId = segment.Id.ToString() })).Items).Id);
        Assert.Empty((await service.GetListAsync(Guid.NewGuid(),
            new AuditLogFilter { EnvId = envId, CrossEnvironment = true, RefId = segment.Id.ToString() })).Items);
        Assert.NotNull(await service.GetLastChangeAsync(envId, "Segment", segment.Id.ToString()));
    }
}

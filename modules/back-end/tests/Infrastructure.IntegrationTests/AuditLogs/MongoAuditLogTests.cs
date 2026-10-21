using Application.AuditLogs;
using Domain.AuditLogs;
using Domain.Organizations;
using Domain.Projects;
using Domain.Segments;
using Domain.Users;
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
        var filter = new AuditLogFilter { Scope = AuditLogScope.Environment, CrossEnvironment = true, PageSize = 1 };
        var ids = new List<Guid>();
        for (var page = 0; page < 3; page++)
        {
            filter.PageIndex = page;
            var result = await service.GetListAsync(org.WorkspaceId, org.Id, env.Id, filter);
            Assert.Equal(3, result.TotalCount);
            ids.Add(Assert.Single(result.Items).Id);
        }
        Assert.Equal(new[] { missingOwner.Id, emptyOwner.Id, explicitOwner.Id }.Order(), ids.Order());
        Assert.Equal(missingOwner.Id, Assert.Single((await service.GetListAsync(org.WorkspaceId, org.Id, env.Id, new AuditLogFilter { Scope = AuditLogScope.Environment })).Items).Id);
        Assert.Empty((await service.GetListAsync(org.WorkspaceId, org.Id, env.Id, new AuditLogFilter { Scope = AuditLogScope.Environment, CrossEnvironment = true, RefId = foreignExplicit.RefId })).Items);
        Assert.Empty((await service.GetListAsync(org.WorkspaceId, org.Id, env.Id, new AuditLogFilter { Scope = AuditLogScope.Environment, CrossEnvironment = true, RefType = "Group" })).Items);
        Assert.Empty((await service.GetListAsync(org.WorkspaceId, org.Id, env.Id, new AuditLogFilter { Scope = AuditLogScope.Iam })).Items);
        foreach (var scope in new[] { AuditLogScope.Unspecified, (AuditLogScope)999 })
        {
            await Assert.ThrowsAsync<ArgumentOutOfRangeException>(() => service.GetListAsync(org.WorkspaceId, org.Id, env.Id, new AuditLogFilter { Scope = scope }));
            await Assert.ThrowsAsync<ArgumentOutOfRangeException>(() => service.GetActorsAsync(org.WorkspaceId, org.Id, env.Id, new AuditLogFilter { Scope = scope }));
        }
        await Assert.ThrowsAsync<ArgumentException>(() => service.GetListAsync(org.WorkspaceId, org.Id, null, new AuditLogFilter { Scope = AuditLogScope.Environment }));
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
        Assert.Equal(log.Id, Assert.Single((await service.GetListAsync(workspaceId, Guid.NewGuid(), envId, new AuditLogFilter { Scope = AuditLogScope.Environment })).Items).Id);
        var otherEnv = Guid.NewGuid();
        Assert.Empty((await service.GetListAsync(workspaceId, Guid.NewGuid(), otherEnv, new AuditLogFilter { Scope = AuditLogScope.Environment })).Items);
        Assert.Equal(log.Id, Assert.Single((await service.GetListAsync(workspaceId, Guid.NewGuid(), otherEnv, new AuditLogFilter { Scope = AuditLogScope.Environment, CrossEnvironment = true, RefType = "Segment", RefId = segment.Id.ToString() })).Items).Id);
        Assert.Empty((await service.GetListAsync(Guid.NewGuid(), Guid.NewGuid(), envId, new AuditLogFilter { Scope = AuditLogScope.Environment, CrossEnvironment = true, RefId = segment.Id.ToString() })).Items);
        Assert.NotNull(await service.GetLastChangeAsync(envId, "Segment", segment.Id.ToString()));
    }
    [DockerFact]
    public async Task Queries_IsolateIamOrganizations_Actors_AndEnvironmentHistory()
    {
        var client = new MongoDbClient(Options.Create(new MongoDbOptions
        { ConnectionString = fixture.ConnectionString, Database = $"audit-iam-{Guid.NewGuid():N}" }));
        var workspaceId = Guid.NewGuid();
        var orgId = Guid.NewGuid();
        var envId = Guid.NewGuid();
        var actor = new User(Guid.NewGuid(), "allowed@example.com", "password", "Allowed");
        var otherActor = new User(Guid.NewGuid(), "hidden@example.com", "password", "Hidden");
        await client.CollectionOf<User>().InsertManyAsync([actor, otherActor]);
        AuditLog Entry(Guid workspace, Guid? org, Guid? env, string type, Guid creator) =>
            new(env, Guid.NewGuid().ToString(), type, "entry", Operations.Create,
                new DataChange(null).To(new { Name = "entry" }), "", creator)
            { WorkspaceId = workspace, OrganizationId = org };
        var allowed = Entry(workspaceId, orgId, null, AuditLogRefTypes.Group, actor.Id);
        var flag = Entry(workspaceId, orgId, envId, AuditLogRefTypes.FeatureFlag, otherActor.Id);
        var shared = Entry(workspaceId, null, null, AuditLogRefTypes.Segment, otherActor.Id);
        await client.CollectionOf<AuditLog>().InsertManyAsync([allowed, flag, shared,
            Entry(workspaceId, Guid.NewGuid(), null, AuditLogRefTypes.Member, otherActor.Id),
            Entry(workspaceId, null, null, AuditLogRefTypes.Member, otherActor.Id),
            Entry(Guid.NewGuid(), orgId, null, AuditLogRefTypes.Policy, otherActor.Id)]);
        var logs = new AuditLogService(client);
        var page = await logs.GetListAsync(workspaceId, orgId, null, new AuditLogFilter { Scope = AuditLogScope.Iam, PageSize = 1 });
        Assert.Equal(1, page.TotalCount);
        Assert.Equal(allowed.Id, Assert.Single(page.Items).Id);
        Assert.Equal(actor.Id, Assert.Single(await logs.GetActorsAsync(workspaceId, orgId, null, new AuditLogFilter { Scope = AuditLogScope.Iam })).Id);
        Assert.Empty(await logs.GetActorsAsync(workspaceId, orgId, null, new AuditLogFilter { Scope = AuditLogScope.Iam, Query = "Hidden" }));
        Assert.Empty((await logs.GetListAsync(workspaceId, orgId, envId, new AuditLogFilter { Scope = AuditLogScope.Iam, RefType = "FeatureFlag", CrossEnvironment = true})).Items);
        Assert.Equal(flag.Id, Assert.Single((await logs.GetListAsync(workspaceId, orgId, envId, new AuditLogFilter { Scope = AuditLogScope.Environment })).Items).Id);
        Assert.Empty((await logs.GetListAsync(workspaceId, orgId, envId, new AuditLogFilter { Scope = AuditLogScope.Environment, CrossEnvironment = true, RefType = "Group" })).Items);
        Assert.Equal(shared.Id, Assert.Single((await logs.GetListAsync(workspaceId, orgId, envId, new AuditLogFilter { Scope = AuditLogScope.Environment, CrossEnvironment = true, RefType = "Segment", RefId = shared.RefId })).Items).Id);
        Assert.Equal(otherActor.Id, Assert.Single(await logs.GetActorsAsync(workspaceId, orgId, envId, new AuditLogFilter { Scope = AuditLogScope.Environment })).Id);
        Assert.Empty(await logs.GetActorsAsync(workspaceId, orgId, envId, new AuditLogFilter { Scope = AuditLogScope.Environment, CrossEnvironment = true, RefType = "Group" }));
        Assert.Empty(await logs.GetActorsAsync(workspaceId, orgId, envId, new AuditLogFilter { Scope = AuditLogScope.Iam, CrossEnvironment = true, RefType = "FeatureFlag" }));
        Assert.Empty(await logs.GetActorsAsync(Guid.NewGuid(), orgId, envId, new AuditLogFilter { Scope = AuditLogScope.Environment, CrossEnvironment = true }));
        Assert.Equal(otherActor.Id, Assert.Single(await logs.GetActorsAsync(workspaceId, orgId, envId, new AuditLogFilter { Scope = AuditLogScope.Environment, CrossEnvironment = true,
                RefType = "Segment", RefId = shared.RefId })).Id);

        foreach (var scope in new[] { AuditLogScope.Unspecified, (AuditLogScope)999 })
        {
            await Assert.ThrowsAsync<ArgumentOutOfRangeException>(() =>
                logs.GetListAsync(workspaceId, orgId, envId, new AuditLogFilter { Scope = scope }));
            await Assert.ThrowsAsync<ArgumentOutOfRangeException>(() =>
                logs.GetActorsAsync(workspaceId, orgId, envId, new AuditLogFilter { Scope = scope }));
        }
        await Assert.ThrowsAsync<ArgumentException>(() =>
            logs.GetListAsync(workspaceId, orgId, null, new AuditLogFilter { Scope = AuditLogScope.Environment }));
        await Assert.ThrowsAsync<ArgumentException>(() =>
            logs.GetActorsAsync(workspaceId, orgId, null, new AuditLogFilter { Scope = AuditLogScope.Environment }));
    }

    [DockerFact]
    public async Task Actors_ReturnExplicitTypes_AndSearchTokensWithNullEmail()
    {
        var client = new MongoDbClient(Options.Create(new MongoDbOptions
        { ConnectionString = fixture.ConnectionString, Database = $"audit-iam-{Guid.NewGuid():N}" }));
        var workspaceId = Guid.NewGuid();
        var orgId = Guid.NewGuid();
        var user = new User(Guid.NewGuid(), "actor@example.com", "password", "Alice");
        var token = new Domain.AccessTokens.AccessToken(Guid.NewGuid(), user.Id, "Deploy bot",
            Domain.AccessTokens.AccessTokenTypes.Service, []);
        await client.CollectionOf<User>().InsertOneAsync(user);
        await client.CollectionOf<Domain.AccessTokens.AccessToken>().InsertOneAsync(token);
        foreach (var creatorId in new[] { user.Id, token.Id })
        {
            await client.CollectionOf<AuditLog>().InsertOneAsync(new AuditLog(null, Guid.NewGuid().ToString(), AuditLogRefTypes.Group, "group",
                Operations.Create, new DataChange(null).To(new { Name = "group" }), "", creatorId)
            {
                WorkspaceId = workspaceId, OrganizationId = orgId
            });
        }
        var logs = new AuditLogService(client);

        var actors = await logs.GetActorsAsync(workspaceId, orgId, null, new AuditLogFilter { Scope = AuditLogScope.Iam });
        Assert.Equal(2, actors.Count);
        var userActor = Assert.Single(actors, x => x.Id == user.Id);
        Assert.Equal(AuditActorTypes.User, userActor.Type);
        Assert.Equal(user.Email, userActor.Email);
        var tokenActor = Assert.Single(actors, x => x.Id == token.Id);
        Assert.Equal(AuditActorTypes.AccessToken, tokenActor.Type);
        Assert.Equal(token.Name, tokenActor.Name);
        Assert.Null(tokenActor.Email);
        Assert.Equal(token.Id, Assert.Single(await logs.GetActorsAsync(workspaceId, orgId, null, new AuditLogFilter { Scope = AuditLogScope.Iam, Query = "deploy" })).Id);
        Assert.Equal(user.Id, Assert.Single(await logs.GetActorsAsync(workspaceId, orgId, null, new AuditLogFilter { Scope = AuditLogScope.Iam, Query = "actor@example.com" })).Id);
    }

}

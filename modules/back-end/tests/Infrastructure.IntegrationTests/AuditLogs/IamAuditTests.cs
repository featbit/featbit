using Application.AuditLogs;
using Domain.AuditLogs;
using Domain.Users;
using Infrastructure.IntegrationTests.Fixtures;
using Infrastructure.IntegrationTests.Support;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.IntegrationTests.AuditLogs;

[Collection(FeatBitPostgresCollection.Name)]
public class IamAuditTests(FeatBitPostgresFixture fixture) : IntegrationTestBase
{
    [DockerFact]
    public async Task Queries_IsolateIamOrganizations_Actors_AndEnvironmentHistory()
    {
        await using var db = AppDbContextFactory.Create(fixture.ConnectionString);
        var workspaceId = Guid.NewGuid();
        var orgId = Guid.NewGuid();
        var envId = Guid.NewGuid();
        var actor = new User(Guid.NewGuid(), "allowed@example.com", "password", "Allowed");
        var otherActor = new User(Guid.NewGuid(), "hidden@example.com", "password", "Hidden");
        db.AddRange(actor, otherActor);
        AuditLog Entry(Guid workspace, Guid? org, Guid? env, string type, Guid creator) =>
            new(workspace, org, env, Guid.NewGuid().ToString(), type, "entry", Operations.Create,
                new DataChange(null).To(new { Name = "entry" }), "", creator);
        var allowed = Entry(workspaceId, orgId, null, AuditLogRefTypes.Group, actor.Id);
        var flag = Entry(workspaceId, orgId, envId, AuditLogRefTypes.FeatureFlag, otherActor.Id);
        var shared = Entry(workspaceId, null, null, AuditLogRefTypes.Segment, otherActor.Id);
        db.AddRange(allowed, flag, shared,
            Entry(workspaceId, Guid.NewGuid(), null, AuditLogRefTypes.Member, otherActor.Id),
            Entry(workspaceId, null, null, AuditLogRefTypes.Member, otherActor.Id),
            Entry(Guid.NewGuid(), orgId, null, AuditLogRefTypes.Policy, otherActor.Id));
        await db.SaveChangesAsync();
        var logs = new Infrastructure.Services.EntityFrameworkCore.AuditLogService(db);
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
        await using var db = AppDbContextFactory.Create(fixture.ConnectionString);
        var workspaceId = Guid.NewGuid();
        var orgId = Guid.NewGuid();
        var user = new User(Guid.NewGuid(), "actor@example.com", "password", "Alice");
        var token = new Domain.AccessTokens.AccessToken(Guid.NewGuid(), user.Id, "Deploy bot",
            Domain.AccessTokens.AccessTokenTypes.Service, []);
        db.AddRange(user, token);
        foreach (var creatorId in new[] { user.Id, token.Id })
        {
            db.Add(new AuditLog(workspaceId, orgId, null, Guid.NewGuid().ToString(), AuditLogRefTypes.Group, "group",
                Operations.Create, new DataChange(null).To(new { Name = "group" }), "", creatorId));
        }
        await db.SaveChangesAsync();
        var logs = new Infrastructure.Services.EntityFrameworkCore.AuditLogService(db);

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

    [DockerFact]
    public async Task Indexes_ReplaceEnvironmentIndex_WithWorkspaceListAndResourceIndexes()
    {
        await using var db = AppDbContextFactory.Create(fixture.ConnectionString);
        var definitions = await db.Database.SqlQueryRaw<string>(
            "SELECT indexdef AS \"Value\" FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'audit_logs' AND indexname <> 'pk_audit_logs'").ToListAsync();
        Assert.Equal(3, definitions.Count);
        Assert.Contains(definitions, x => x.Contains("ix_audit_logs_workspace_org_created ") &&
            x.EndsWith("(workspace_id, organization_id, created_at DESC, id DESC)"));
        Assert.Contains(definitions, x => x.Contains("ix_audit_logs_workspace_created ") &&
            x.EndsWith("(workspace_id, created_at DESC, id DESC)"));
        Assert.Contains(definitions, x => x.Contains("ix_audit_logs_workspace_resource_created ") &&
            x.EndsWith("(workspace_id, ref_type, ref_id, created_at DESC, id DESC)"));
    }

    [DockerFact]
    public async Task Schema_OnlyAddsOwnershipColumns_AndMakesEnvironmentNullable()
    {
        await using var db = AppDbContextFactory.Create(fixture.ConnectionString);
        var columns = await db.Database.SqlQueryRaw<string>(
            "SELECT column_name AS \"Value\" FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'audit_logs'").ToListAsync();
        string[] expected = ["id", "env_id", "ref_id", "ref_type", "keyword", "operation", "data_change", "comment", "creator_id", "created_at", "workspace_id", "organization_id"];
        Assert.Equal(expected.Order(), columns.Order());
        var nullable = await db.Database.SqlQueryRaw<string>(
            "SELECT is_nullable AS \"Value\" FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'env_id'").SingleAsync();
        Assert.Equal("YES", nullable);
        var keywordLength = await db.Database.SqlQueryRaw<int>(
            "SELECT character_maximum_length AS \"Value\" FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'keyword'").SingleAsync();
        Assert.Equal(512, keywordLength);
    }
}

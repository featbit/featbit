using Application.AuditLogs;
using Application.Groups;
using Application.Policies;
using Application.Services;
using Application.Users;
using Domain.AuditLogs;
using Domain.Groups;
using Domain.Organizations;
using Domain.Users;
using Domain.Policies;
using Domain.Members;
using Infrastructure.IntegrationTests.Fixtures;
using Infrastructure.IntegrationTests.Support;
using Infrastructure.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Moq;

namespace Infrastructure.IntegrationTests.AuditLogs;

[Collection(FeatBitPostgresCollection.Name)]
public class IamAuditTests(FeatBitPostgresFixture fixture) : IntegrationTestBase
{
    [DockerTheory]
    [InlineData(PolicyTypes.CustomerManaged)]
    [InlineData(PolicyTypes.SysManaged)]
    public async Task ClonePolicy_PersistsOriginalIdAndKey_ForSelectedPolicyType(string sourceType)
    {
        await using var db = AppDbContextFactory.Create(fixture.ConnectionString);
        var org = new Organization(Guid.NewGuid(), "Clone audit", Guid.NewGuid().ToString()) { Id = Guid.NewGuid() };
        var key = $"source-{Guid.NewGuid():N}";
        var customer = new Policy(org.Id, "Customer source", key, "") { Id = Guid.NewGuid() };
        var system = new Policy(org.Id, "System source", key, "")
        {
            Id = Guid.NewGuid(), OrganizationId = null, Type = PolicyTypes.SysManaged
        };
        db.AddRange(org, customer, system);
        await db.SaveChangesAsync();
        var sourceId = sourceType == PolicyTypes.CustomerManaged ? customer.Id : system.Id;
        using var services = new ServiceCollection().AddSingleton(db).BuildServiceProvider();
        var store = new AuditStore(services);
        var organizations = new Mock<IOrganizationService>();
        organizations.Setup(x => x.GetAsync(org.Id)).ReturnsAsync(org);
        var logs = new Infrastructure.Services.EntityFrameworkCore.AuditLogService(db,
            new AuditLogEnricher(Mock.Of<IEnvironmentService>(), Mock.Of<IProjectService>(), organizations.Object));
        var http = new DefaultHttpContext();
        http.Request.Headers["Organization"] = org.Id.ToString();
        http.Request.Headers["Workspace"] = org.WorkspaceId.ToString();
        var mapper = new AutoMapper.MapperConfiguration(config => config.AddProfile<Application.Policies.MapperProfile>())
            .CreateMapper();
        var handler = new ClonePolicyHandler(new Infrastructure.Services.EntityFrameworkCore.PolicyService(db), mapper);
        var request = new ClonePolicy
        {
            OrgId = org.Id, OriginPolicyKey = key, OriginPolicyType = sourceType,
            Name = "Cloned", Key = $"clone-{Guid.NewGuid():N}", Description = ""
        };
        var result = await new IamAuditBehaviour<ClonePolicy, PolicyVm>(store, logs, Mock.Of<ICurrentUser>(),
                new HttpContextAccessor { HttpContext = http })
            .Handle(request, ct => handler.Handle(request, ct), CancellationToken.None);

        db.ChangeTracker.Clear();
        var log = await db.Set<AuditLog>().SingleAsync(x => x.RefId == result.Id);
        Assert.Equal(Operations.ClonePolicy, log.Operation);
        Assert.Equal(new PolicyCloneSource(sourceId, key), log.DataChange.ClonedFrom);
        Assert.NotEqual(sourceId.ToString(), result.Id);
        Assert.Empty(log.DataChange.Previous);
        Assert.Contains(request.Key, log.DataChange.Current);
        var storedJson = await db.Database.SqlQuery<string>(
            $"SELECT data_change::text AS \"Value\" FROM audit_logs WHERE id = {log.Id}").SingleAsync();
        using var json = System.Text.Json.JsonDocument.Parse(storedJson);
        Assert.False(json.RootElement.TryGetProperty("source", out _));
        Assert.Equal(sourceId, json.RootElement.GetProperty("clonedFrom").GetProperty("id").GetGuid());
        Assert.Equal(key, json.RootElement.GetProperty("clonedFrom").GetProperty("key").GetString());
    }

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
            new(env, Guid.NewGuid().ToString(), type, "entry", Operations.Create,
                new DataChange(null).To(new { Name = "entry" }), "", creator)
            { WorkspaceId = workspace, OrganizationId = org };
        var allowed = Entry(workspaceId, orgId, null, AuditLogRefTypes.Group, actor.Id);
        var flag = Entry(workspaceId, orgId, envId, AuditLogRefTypes.FeatureFlag, otherActor.Id);
        var shared = Entry(workspaceId, null, null, AuditLogRefTypes.Segment, otherActor.Id);
        db.AddRange(allowed, flag, shared,
            Entry(workspaceId, Guid.NewGuid(), null, AuditLogRefTypes.Member, otherActor.Id),
            Entry(workspaceId, null, null, AuditLogRefTypes.Member, otherActor.Id),
            Entry(Guid.NewGuid(), orgId, null, AuditLogRefTypes.Policy, otherActor.Id));
        await db.SaveChangesAsync();
        var logs = new Infrastructure.Services.EntityFrameworkCore.AuditLogService(db,
            new AuditLogEnricher(Mock.Of<IEnvironmentService>(), Mock.Of<IProjectService>(), Mock.Of<IOrganizationService>()));
        var page = await logs.GetListAsync(workspaceId, orgId, new AuditLogFilter { Scope = AuditLogScope.Iam, PageSize = 1 });
        Assert.Equal(1, page.TotalCount);
        Assert.Equal(allowed.Id, Assert.Single(page.Items).Id);
        Assert.Equal(actor.Id, Assert.Single(await logs.GetActorsAsync(workspaceId, orgId, new AuditLogFilter { Scope = AuditLogScope.Iam })).Id);
        Assert.Empty(await logs.GetActorsAsync(workspaceId, orgId, new AuditLogFilter { Scope = AuditLogScope.Iam, Query = "Hidden" }));
        Assert.Empty((await logs.GetListAsync(workspaceId, orgId, new AuditLogFilter { Scope = AuditLogScope.Iam, RefType = "FeatureFlag", CrossEnvironment = true, EnvId = envId })).Items);
        Assert.Equal(flag.Id, Assert.Single((await logs.GetListAsync(workspaceId, orgId, new AuditLogFilter { Scope = AuditLogScope.Environment, EnvId = envId })).Items).Id);
        Assert.Empty((await logs.GetListAsync(workspaceId, orgId, new AuditLogFilter { Scope = AuditLogScope.Environment, EnvId = envId, CrossEnvironment = true, RefType = "Group" })).Items);
        Assert.Equal(shared.Id, Assert.Single((await logs.GetListAsync(workspaceId, orgId, new AuditLogFilter { Scope = AuditLogScope.Environment, EnvId = envId, CrossEnvironment = true, RefType = "Segment", RefId = shared.RefId })).Items).Id);
        Assert.Equal(otherActor.Id, Assert.Single(await logs.GetActorsAsync(workspaceId, orgId, new AuditLogFilter { Scope = AuditLogScope.Environment, EnvId = envId })).Id);
        Assert.Empty(await logs.GetActorsAsync(workspaceId, orgId, new AuditLogFilter { Scope = AuditLogScope.Environment, EnvId = envId, CrossEnvironment = true, RefType = "Group" }));
        Assert.Empty(await logs.GetActorsAsync(workspaceId, orgId, new AuditLogFilter { Scope = AuditLogScope.Iam, EnvId = envId, CrossEnvironment = true, RefType = "FeatureFlag" }));
        Assert.Empty(await logs.GetActorsAsync(Guid.NewGuid(), orgId, new AuditLogFilter { Scope = AuditLogScope.Environment, EnvId = envId, CrossEnvironment = true }));
        Assert.Equal(otherActor.Id, Assert.Single(await logs.GetActorsAsync(workspaceId, orgId, new AuditLogFilter { Scope = AuditLogScope.Environment, EnvId = envId, CrossEnvironment = true,
                RefType = "Segment", RefId = shared.RefId })).Id);

        foreach (var scope in new[] { AuditLogScope.Unspecified, (AuditLogScope)999 })
        {
            await Assert.ThrowsAsync<ArgumentOutOfRangeException>(() =>
                logs.GetListAsync(workspaceId, orgId, new AuditLogFilter { Scope = scope, EnvId = envId }));
            await Assert.ThrowsAsync<ArgumentOutOfRangeException>(() =>
                logs.GetActorsAsync(workspaceId, orgId, new AuditLogFilter { Scope = scope, EnvId = envId }));
        }
        await Assert.ThrowsAsync<ArgumentException>(() =>
            logs.GetListAsync(workspaceId, orgId, new AuditLogFilter { Scope = AuditLogScope.Environment }));
        await Assert.ThrowsAsync<ArgumentException>(() =>
            logs.GetActorsAsync(workspaceId, orgId, new AuditLogFilter { Scope = AuditLogScope.Environment }));
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
            db.Add(new AuditLog(null, Guid.NewGuid().ToString(), AuditLogRefTypes.Group, "group",
                Operations.Create, new DataChange(null).To(new { Name = "group" }), "", creatorId)
            {
                WorkspaceId = workspaceId, OrganizationId = orgId
            });
        }
        await db.SaveChangesAsync();
        var enricher = new AuditLogEnricher(Mock.Of<IEnvironmentService>(), Mock.Of<IProjectService>(),
            Mock.Of<IOrganizationService>());
        var logs = new Infrastructure.Services.EntityFrameworkCore.AuditLogService(db, enricher);

        var actors = await logs.GetActorsAsync(workspaceId, orgId, new AuditLogFilter { Scope = AuditLogScope.Iam });
        Assert.Equal(2, actors.Count);
        var userActor = Assert.Single(actors, x => x.Id == user.Id);
        Assert.Equal(AuditActorTypes.User, userActor.Type);
        Assert.Equal(user.Email, userActor.Email);
        var tokenActor = Assert.Single(actors, x => x.Id == token.Id);
        Assert.Equal(AuditActorTypes.AccessToken, tokenActor.Type);
        Assert.Equal(token.Name, tokenActor.Name);
        Assert.Null(tokenActor.Email);
        Assert.Equal(token.Id, Assert.Single(await logs.GetActorsAsync(workspaceId, orgId, new AuditLogFilter { Scope = AuditLogScope.Iam, Query = "deploy" })).Id);
        Assert.Equal(user.Id, Assert.Single(await logs.GetActorsAsync(workspaceId, orgId, new AuditLogFilter { Scope = AuditLogScope.Iam, Query = "actor@example.com" })).Id);
    }

    [DockerFact]
    public async Task Profile_RecordsNameAndEmailAcrossMemberships_AndSkipsUnchangedSave()
    {
        await using var db = AppDbContextFactory.Create(fixture.ConnectionString);
        var user = new User(Guid.NewGuid(), "before@example.com", "private-password", "Before", initialPassword: "private-initial");
        var org = new Organization(Guid.NewGuid(), "First", Guid.NewGuid().ToString()) { Id = Guid.NewGuid() };
        var other = new Organization(Guid.NewGuid(), "Second", Guid.NewGuid().ToString()) { Id = Guid.NewGuid() };
        db.AddRange(user, org, other, new OrganizationUser(org.Id, user.Id), new OrganizationUser(other.Id, user.Id));
        await db.SaveChangesAsync();
        using var services = new ServiceCollection().AddSingleton(db).BuildServiceProvider();
        var store = new AuditStore(services);
        var orgs = new Mock<IOrganizationService>();
        orgs.Setup(x => x.GetAsync(org.Id)).ReturnsAsync(org);
        orgs.Setup(x => x.GetAsync(other.Id)).ReturnsAsync(other);
        var enricher = new AuditLogEnricher(Mock.Of<IEnvironmentService>(), Mock.Of<IProjectService>(), orgs.Object);
        var logs = new Infrastructure.Services.EntityFrameworkCore.AuditLogService(db, enricher);
        var current = new Mock<ICurrentUser>(); current.SetupGet(x => x.Id).Returns(user.Id);
        var handler = new UpdateProfileHandler(new Infrastructure.Services.EntityFrameworkCore.UserService(db), current.Object);
        var pipeline = new IamAuditBehaviour<UpdateProfile, Application.Users.Profile>(store, logs, current.Object, new HttpContextAccessor());
        var request = new UpdateProfile { Name = "After", Email = "after@example.com" };
        await pipeline.Handle(request, ct => handler.Handle(request, ct), CancellationToken.None);
        await pipeline.Handle(request, ct => handler.Handle(request, ct), CancellationToken.None);
        db.ChangeTracker.Clear();
        var events = await db.Set<AuditLog>().Where(x => x.RefId == user.Id.ToString()).ToListAsync();
        Assert.Equal(2, events.Count);
        Assert.Contains(events, x => x.OrganizationId == org.Id && x.WorkspaceId == org.WorkspaceId);
        Assert.Contains(events, x => x.OrganizationId == other.Id && x.WorkspaceId == other.WorkspaceId);
        foreach (var entry in events)
        {
            Assert.Equal(AuditLogRefTypes.Member, entry.RefType);
            Assert.Equal(user.Id, entry.CreatorId);
            Assert.Equal("UpdateProfile", entry.Operation);
            Assert.Null(entry.EnvId);
            Assert.Contains("Before", entry.DataChange.Previous);
            Assert.Contains("before@example.com", entry.DataChange.Previous);
            Assert.Contains("After", entry.DataChange.Current);
            Assert.Contains("member/after@example.com", entry.DataChange.Current);
            Assert.DoesNotContain("private-", entry.DataChange.Previous + entry.DataChange.Current);
        }
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

    [DockerFact]
    public async Task GroupMembership_RecordsRnAndActor_WithoutCredentials_AndSkipsNoOp()
    {
        await using var db = AppDbContextFactory.Create(fixture.ConnectionString);
        var org = new Organization(Guid.NewGuid(), "Audit org", Guid.NewGuid().ToString()) { Id = Guid.NewGuid() };
        var user = new User(Guid.NewGuid(), "audit@example.com", "secret-password", "Alice");
        var group = new Group(org.Id, "Engineering", "Team") { Id = Guid.NewGuid() };
        db.AddRange(org, user, group, new OrganizationUser(org.Id, user.Id));
        await db.SaveChangesAsync();
        using var services = new ServiceCollection().AddSingleton(db).BuildServiceProvider();
        var store = new AuditStore(services);
        var orgs = new Mock<IOrganizationService>(); orgs.Setup(x => x.GetAsync(org.Id)).ReturnsAsync(org);
        var users = new Mock<IUserService>(); users.Setup(x => x.FindOneAsync(It.IsAny<System.Linq.Expressions.Expression<Func<User, bool>>>())).ReturnsAsync(user);
        var enricher = new AuditLogEnricher(Mock.Of<IEnvironmentService>(), Mock.Of<IProjectService>(), orgs.Object);
        var logs = new Infrastructure.Services.EntityFrameworkCore.AuditLogService(db, enricher);
        var current = new Mock<ICurrentUser>(); current.SetupGet(x => x.Id).Returns(user.Id);
        var context = new DefaultHttpContext();
        context.Request.Headers["Organization"] = org.Id.ToString(); context.Request.Headers["Workspace"] = org.WorkspaceId.ToString();
        var access = new HttpContextAccessor { HttpContext = context };
        var pipeline = new IamAuditBehaviour<AddGroupMember, bool>(store, logs, current.Object, access);
        var handler = new AddGroupMemberHandler(new Infrastructure.Services.EntityFrameworkCore.GroupService(db));
        var command = new AddGroupMember { GroupId = group.Id, MemberId = user.Id, OrganizationId = org.Id };
        await pipeline.Handle(command, ct => handler.Handle(command, ct), CancellationToken.None);
        await pipeline.Handle(command, ct => handler.Handle(command, ct), CancellationToken.None);
        var page = await logs.GetListAsync(org.WorkspaceId, org.Id, new AuditLogFilter { Scope = AuditLogScope.Iam });
        var log = Assert.Single(page.Items);
        Assert.Null(log.EnvId); Assert.Equal(org.Id, log.OrganizationId);
        Assert.Equal(user.Id, log.CreatorId); Assert.Equal("AddGroupMember", log.Operation);
        Assert.Contains("group/Engineering", log.DataChange.Current);
        Assert.Contains("member/audit@example.com", log.DataChange.Current);
        Assert.DoesNotContain("secret-password", log.DataChange.Current);
        foreach (var raw in new[] { log.DataChange.Previous, log.DataChange.Current })
        {
            using var snapshot = System.Text.Json.JsonDocument.Parse(raw);
            Assert.Equal(new[] { "description", "id", "members", "name", "policies", "rn" },
                snapshot.RootElement.EnumerateObject().Select(x => x.Name).Order().ToArray());
            Assert.Equal(System.Text.Json.JsonValueKind.Array, snapshot.RootElement.GetProperty("policies").ValueKind);
        }
        Assert.Empty((await logs.GetListAsync(Guid.NewGuid(), org.Id, new AuditLogFilter { Scope = AuditLogScope.Iam })).Items);
        Assert.Empty((await logs.GetListAsync(org.WorkspaceId, org.Id, new AuditLogFilter { Scope = AuditLogScope.Environment, EnvId = Guid.NewGuid() })).Items);
        Assert.Empty((await logs.GetListAsync(org.WorkspaceId, org.Id, new AuditLogFilter { Scope = AuditLogScope.Iam, RefType = "Policy" })).Items);
        Assert.Single(await logs.GetActorsAsync(org.WorkspaceId, org.Id, new AuditLogFilter { Scope = AuditLogScope.Iam, Query = "Alice" }));

        // A policy change records the semantic before/after and survives deletion
        // with the removed assignments preserved in the snapshot.
        var policy = new Policy(org.Id, "Developer", "developer", "") { Id = Guid.NewGuid() };
        db.AddRange(policy, new GroupPolicy(group.Id, policy.Id), new MemberPolicy(org.Id, user.Id, policy.Id));
        await db.SaveChangesAsync();
        var policyService = new Infrastructure.Services.EntityFrameworkCore.PolicyService(db);
        var update = new UpdatePolicyStatements { PolicyId = policy.Id, Statements = [new PolicyStatement
        { Id = "s1", ResourceType = "flag", Effect = "deny", Actions = ["ToggleFlag"], Resources = ["project/*"] }] };
        var updateHandler = new UpdatePolicyStatementsHandler(policyService, Mock.Of<AutoMapper.IMapper>());
        await new IamAuditBehaviour<UpdatePolicyStatements, PolicyVm>(store, logs, current.Object, access)
            .Handle(update, ct => updateHandler.Handle(update, ct), CancellationToken.None);
        var deletion = new DeletePolicy { PolicyId = policy.Id };
        var deleteHandler = new DeletePolicyHandler(policyService);
        await new IamAuditBehaviour<DeletePolicy, bool>(store, logs, current.Object, access)
            .Handle(deletion, ct => deleteHandler.Handle(deletion, ct), CancellationToken.None);
        var policyLogs = (await logs.GetListAsync(org.WorkspaceId, org.Id, new AuditLogFilter { Scope = AuditLogScope.Iam, RefType = "Policy" })).Items;
        Assert.Equal(2, policyLogs.Count());
        var removed = Assert.Single(policyLogs, x => x.Operation == Operations.DeletePolicy);
        Assert.Contains("group/Engineering", removed.DataChange.Previous);
        Assert.Contains("member/audit@example.com", removed.DataChange.Previous);
        Assert.Contains("deny", removed.DataChange.Previous);
        Assert.Empty(removed.DataChange.Current);
        Assert.False(await db.Set<GroupPolicy>().AnyAsync(x => x.PolicyId == policy.Id));
    }

    [DockerFact]
    public async Task TransactionFailure_RollsBackRelationshipAndAudit()
    {
        await using var db = AppDbContextFactory.Create(fixture.ConnectionString);
        using var services = new ServiceCollection().AddSingleton(db).BuildServiceProvider();
        var store = new AuditStore(services);
        var relation = new GroupMember(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
        await Assert.ThrowsAsync<InvalidOperationException>(() => store.Transaction<bool>(async () =>
        {
            db.Add(relation); await db.SaveChangesAsync();
            throw new InvalidOperationException("audit storage failed");
        }, CancellationToken.None));
        Assert.False(await db.Set<GroupMember>().AnyAsync(x => x.Id == relation.Id));
    }
}

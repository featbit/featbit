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
using Infrastructure.Services;
using Microsoft.AspNetCore.Http;
using MongoDB.Driver;
using MongoDB.Driver.Linq;
using Microsoft.Extensions.Options;
using Infrastructure.Persistence.MongoDb;
using Microsoft.Extensions.DependencyInjection;
using Moq;

namespace Infrastructure.IntegrationTests.AuditLogs;

[Collection(MongoCollection.Name)]
public class MongoIamAuditTests(MongoDbFixture fixture) : IntegrationTestBase
{
    [DockerTheory]
    [InlineData(PolicyTypes.CustomerManaged)]
    [InlineData(PolicyTypes.SysManaged)]
    public async Task ClonePolicy_PersistsSourceInComment_ForSelectedPolicyType(string sourceType)
    {
        var db = new MongoDbClient(Options.Create(new MongoDbOptions
        { ConnectionString = fixture.ConnectionString, Database = $"iam-write-{Guid.NewGuid():N}" }));
        var org = new Organization(Guid.NewGuid(), "Clone audit", Guid.NewGuid().ToString()) { Id = Guid.NewGuid() };
        var key = $"source-{Guid.NewGuid():N}";
        var customer = new Policy(org.Id, "Customer source", key, "") { Id = Guid.NewGuid() };
        var system = new Policy(org.Id, "System source", key, "")
        {
            Id = Guid.NewGuid(), OrganizationId = null, Type = PolicyTypes.SysManaged
        };
        await db.CollectionOf<Organization>().InsertOneAsync(org);
        await db.CollectionOf<Policy>().InsertManyAsync([customer, system]);
        var sourceId = sourceType == PolicyTypes.CustomerManaged ? customer.Id : system.Id;
        using var services = new ServiceCollection().AddSingleton(db).BuildServiceProvider();
        var store = new AuditStore(services);
        var logs = new Infrastructure.Services.MongoDb.AuditLogService(db);
        var http = new DefaultHttpContext();
        http.Request.Headers["Organization"] = org.Id.ToString();
        http.Request.Headers["Workspace"] = org.WorkspaceId.ToString();
        var mapper = new AutoMapper.MapperConfiguration(config => config.AddProfile<Application.Policies.MapperProfile>())
            .CreateMapper();
        var handler = new ClonePolicyHandler(new Infrastructure.Services.MongoDb.PolicyService(db), mapper);
        var request = new ClonePolicy
        {
            OrgId = org.Id, OriginPolicyKey = key, OriginPolicyType = sourceType,
            Name = "Cloned", Key = $"clone-{Guid.NewGuid():N}", Description = ""
        };
        var result = await new IamAuditBehaviour<ClonePolicy, PolicyVm>(store, logs, Mock.Of<ICurrentUser>(),
                new HttpContextAccessor { HttpContext = http })
            .Handle(request, ct => handler.Handle(request, ct), CancellationToken.None);

        var log = await db.QueryableOf<AuditLog>().SingleAsync(x => x.RefId == result.Id);
        Assert.Equal(Operations.ClonePolicy, log.Operation);
        var sourceLabel = sourceType == PolicyTypes.SysManaged ? "system-managed" : "customer-managed";
        Assert.Equal($"Cloned from: {sourceLabel} policy/{key}", log.Comment);
        Assert.NotEqual(sourceId.ToString(), result.Id);
        Assert.Empty(log.DataChange.Previous);
        Assert.Contains(request.Key, log.DataChange.Current);

    }

    [DockerFact]
    public async Task Profile_RecordsNameAndEmailAcrossMemberships_AndSkipsUnchangedSave()
    {
        var db = new MongoDbClient(Options.Create(new MongoDbOptions
        { ConnectionString = fixture.ConnectionString, Database = $"iam-write-{Guid.NewGuid():N}" }));
        var user = new User(Guid.NewGuid(), "before@example.com", "private-password", "Before", initialPassword: "private-initial");
        var org = new Organization(Guid.NewGuid(), "First", Guid.NewGuid().ToString()) { Id = Guid.NewGuid() };
        var other = new Organization(Guid.NewGuid(), "Second", Guid.NewGuid().ToString()) { Id = Guid.NewGuid() };
        await db.CollectionOf<User>().InsertOneAsync(user);
        await db.CollectionOf<Organization>().InsertManyAsync([org, other]);
        await db.CollectionOf<OrganizationUser>().InsertManyAsync([new(org.Id, user.Id), new(other.Id, user.Id)]);
        using var services = new ServiceCollection().AddSingleton(db).BuildServiceProvider();
        var store = new AuditStore(services);
        var logs = new Infrastructure.Services.MongoDb.AuditLogService(db);
        var current = new Mock<ICurrentUser>(); current.SetupGet(x => x.Id).Returns(user.Id);
        var handler = new UpdateProfileHandler(new Infrastructure.Services.MongoDb.UserService(db), current.Object);
        var pipeline = new IamAuditBehaviour<UpdateProfile, Application.Users.Profile>(store, logs, current.Object, new HttpContextAccessor());
        var request = new UpdateProfile { Name = "After", Email = "after@example.com" };
        await pipeline.Handle(request, ct => handler.Handle(request, ct), CancellationToken.None);
        await pipeline.Handle(request, ct => handler.Handle(request, ct), CancellationToken.None);
        var events = await db.QueryableOf<AuditLog>().Where(x => x.RefId == user.Id.ToString()).ToListAsync();
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
    public async Task GroupMembership_RecordsRnAndActor_WithoutCredentials_AndSkipsNoOp()
    {
        var db = new MongoDbClient(Options.Create(new MongoDbOptions
        { ConnectionString = fixture.ConnectionString, Database = $"iam-write-{Guid.NewGuid():N}" }));
        var org = new Organization(Guid.NewGuid(), "Audit org", Guid.NewGuid().ToString()) { Id = Guid.NewGuid() };
        var user = new User(Guid.NewGuid(), "audit@example.com", "secret-password", "Alice");
        var group = new Group(org.Id, "Engineering", "Team") { Id = Guid.NewGuid() };
        await db.CollectionOf<Organization>().InsertOneAsync(org);
        await db.CollectionOf<User>().InsertOneAsync(user);
        await db.CollectionOf<Group>().InsertOneAsync(group);
        await db.CollectionOf<OrganizationUser>().InsertOneAsync(new(org.Id, user.Id));
        using var services = new ServiceCollection().AddSingleton(db).BuildServiceProvider();
        var store = new AuditStore(services);
        var logs = new Infrastructure.Services.MongoDb.AuditLogService(db);
        var current = new Mock<ICurrentUser>(); current.SetupGet(x => x.Id).Returns(user.Id);
        var context = new DefaultHttpContext();
        context.Request.Headers["Organization"] = org.Id.ToString(); context.Request.Headers["Workspace"] = org.WorkspaceId.ToString();
        var access = new HttpContextAccessor { HttpContext = context };
        var pipeline = new IamAuditBehaviour<AddGroupMember, bool>(store, logs, current.Object, access);
        var handler = new AddGroupMemberHandler(new Infrastructure.Services.MongoDb.GroupService(db));
        var command = new AddGroupMember { GroupId = group.Id, MemberId = user.Id, OrganizationId = org.Id };
        await pipeline.Handle(command, ct => handler.Handle(command, ct), CancellationToken.None);
        await pipeline.Handle(command, ct => handler.Handle(command, ct), CancellationToken.None);
        var page = await logs.GetListAsync(org.WorkspaceId, org.Id, null, new AuditLogFilter { Scope = AuditLogScope.Iam });
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
        Assert.Empty((await logs.GetListAsync(Guid.NewGuid(), org.Id, null, new AuditLogFilter { Scope = AuditLogScope.Iam })).Items);
        Assert.Empty((await logs.GetListAsync(org.WorkspaceId, org.Id, Guid.NewGuid(), new AuditLogFilter { Scope = AuditLogScope.Environment })).Items);
        Assert.Empty((await logs.GetListAsync(org.WorkspaceId, org.Id, null, new AuditLogFilter { Scope = AuditLogScope.Iam, RefType = "Policy" })).Items);
        Assert.Single(await logs.GetActorsAsync(org.WorkspaceId, org.Id, null, new AuditLogFilter { Scope = AuditLogScope.Iam, Query = "Alice" }));

        // A policy change records the semantic before/after and survives deletion
        // with the removed assignments preserved in the snapshot.
        var policy = new Policy(org.Id, "Developer", "developer", "") { Id = Guid.NewGuid() };
        await db.CollectionOf<Policy>().InsertOneAsync(policy);
        await db.CollectionOf<GroupPolicy>().InsertOneAsync(new(group.Id, policy.Id));
        await db.CollectionOf<MemberPolicy>().InsertOneAsync(new(org.Id, user.Id, policy.Id));
        var policyService = new Infrastructure.Services.MongoDb.PolicyService(db);
        var update = new UpdatePolicyStatements { PolicyId = policy.Id, Statements = [new PolicyStatement
        { Id = "s1", ResourceType = "flag", Effect = "deny", Actions = ["ToggleFlag"], Resources = ["project/*"] }] };
        var updateHandler = new UpdatePolicyStatementsHandler(policyService, Mock.Of<AutoMapper.IMapper>());
        await new IamAuditBehaviour<UpdatePolicyStatements, PolicyVm>(store, logs, current.Object, access)
            .Handle(update, ct => updateHandler.Handle(update, ct), CancellationToken.None);
        var deletion = new DeletePolicy { PolicyId = policy.Id };
        var deleteHandler = new DeletePolicyHandler(policyService);
        await new IamAuditBehaviour<DeletePolicy, bool>(store, logs, current.Object, access)
            .Handle(deletion, ct => deleteHandler.Handle(deletion, ct), CancellationToken.None);
        var policyLogs = (await logs.GetListAsync(org.WorkspaceId, org.Id, null, new AuditLogFilter { Scope = AuditLogScope.Iam, RefType = "Policy" })).Items;
        Assert.Equal(2, policyLogs.Count());
        var removed = Assert.Single(policyLogs, x => x.Operation == Operations.DeletePolicy);
        Assert.Contains("group/Engineering", removed.DataChange.Previous);
        Assert.Contains("member/audit@example.com", removed.DataChange.Previous);
        Assert.Contains("deny", removed.DataChange.Previous);
        Assert.Empty(removed.DataChange.Current);
        Assert.False(await db.QueryableOf<GroupPolicy>().AnyAsync(x => x.PolicyId == policy.Id));
    }


    [DockerTheory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task CreateGroup_RejectsWrongWorkspaceOrOrganization_BeforeMutation(bool wrongOrganization)
    {
        var db = new MongoDbClient(Options.Create(new MongoDbOptions
        { ConnectionString = fixture.ConnectionString, Database = $"iam-boundary-{Guid.NewGuid():N}" }));
        var org = new Organization(Guid.NewGuid(), "Own", "own");
        await db.CollectionOf<Organization>().InsertOneAsync(org);
        using var services = new ServiceCollection().AddSingleton(db).BuildServiceProvider();
        var store = new AuditStore(services);
        var context = new DefaultHttpContext();
        context.Request.Headers["Organization"] = org.Id.ToString();
        context.Request.Headers["Workspace"] = (wrongOrganization ? org.WorkspaceId : Guid.NewGuid()).ToString();
        var request = new CreateGroup { OrganizationId = wrongOrganization ? Guid.NewGuid() : org.Id, Name = "Group", Description = "" };
        var invoked = false;
        var pipeline = new IamAuditBehaviour<CreateGroup, GroupVm>(store,
            new Infrastructure.Services.MongoDb.AuditLogService(db), Mock.Of<ICurrentUser>(),
            new HttpContextAccessor { HttpContext = context });
        await Assert.ThrowsAsync<Application.Bases.Exceptions.ForbiddenException>(() => pipeline.Handle(request, _ =>
        {
            invoked = true;
            return Task.FromResult(new GroupVm());
        }, CancellationToken.None));
        Assert.False(invoked);
        Assert.False(store.Active);
        Assert.Empty(await db.QueryableOf<AuditLog>().ToListAsync());
    }

    [DockerTheory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task CreateGroup_PreservesStandaloneWrites_AndResetsAuditState(bool auditFails)
    {
        var db = new MongoDbClient(Options.Create(new MongoDbOptions
        { ConnectionString = fixture.ConnectionString, Database = $"iam-create-{Guid.NewGuid():N}" }));
        var org = new Organization(Guid.NewGuid(), "Own", "own");
        await db.CollectionOf<Organization>().InsertOneAsync(org);
        using var services = new ServiceCollection().AddSingleton(db).BuildServiceProvider();
        var store = new AuditStore(services);
        var context = new DefaultHttpContext();
        context.Request.Headers["Organization"] = org.Id.ToString();
        context.Request.Headers["Workspace"] = org.WorkspaceId.ToString();
        var access = new HttpContextAccessor { HttpContext = context };
        var actor = Mock.Of<ICurrentUser>();
        var realLogs = new Infrastructure.Services.MongoDb.AuditLogService(db);
        var failedLogs = new Mock<IAuditLogService>();
        failedLogs.Setup(x => x.AddOneAsync(It.IsAny<AuditLog>())).ThrowsAsync(new InvalidOperationException("audit write failed"));
        IAuditLogService logs = auditFails ? failedLogs.Object : realLogs;
        var mapper = new AutoMapper.MapperConfiguration(x => x.AddProfile<Application.Groups.MapperProfile>()).CreateMapper();
        var handler = new CreateGroupHandler(new Infrastructure.Services.MongoDb.GroupService(db), mapper);
        var request = new CreateGroup { OrganizationId = org.Id, Name = "New group", Description = "" };
        var pipeline = new IamAuditBehaviour<CreateGroup, GroupVm>(store, logs, actor, access);
        // Nested commands share the outer audit operation and must not duplicate its log.
        Task<GroupVm> Execute() => pipeline.Handle(request,
            ct => pipeline.Handle(request, inner => handler.Handle(request, inner), ct), CancellationToken.None);
        if (auditFails) await Assert.ThrowsAsync<InvalidOperationException>(Execute);
        else await Execute();
        Assert.False(store.Active);
        var group = Assert.Single(await db.QueryableOf<Group>().ToListAsync());
        var entries = await db.QueryableOf<AuditLog>().ToListAsync();
        if (auditFails)
        {
            Assert.Empty(entries);
            failedLogs.Verify(x => x.AddOneAsync(It.IsAny<AuditLog>()), Times.Once);
        }
        else
        {
            var entry = Assert.Single(entries);
            Assert.Equal(group.Id.ToString(), entry.RefId);
            Assert.Equal(org.Id, entry.OrganizationId);
            Assert.Equal(org.WorkspaceId, entry.WorkspaceId);
            Assert.Empty(entry.DataChange.Previous);
            using var snapshot = System.Text.Json.JsonDocument.Parse(entry.DataChange.Current);
            Assert.Equal(new[] { "description", "id", "members", "name", "policies", "rn" },
                snapshot.RootElement.EnumerateObject().Select(x => x.Name).Order().ToArray());
            Assert.Equal("", snapshot.RootElement.GetProperty("description").GetString());
            Assert.Equal(0, snapshot.RootElement.GetProperty("members").GetArrayLength());
            Assert.Equal(0, snapshot.RootElement.GetProperty("policies").GetArrayLength());
        }
    }
}

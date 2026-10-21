using Application.Bases.Exceptions;
using Application.Groups;
using Application.Members;
using Application.Policies;
using Application.Services;
using Application.Users;
using Domain.AuditLogs;
using Domain.Bases;
using Domain.Groups;
using Domain.Members;
using Domain.Organizations;
using Domain.Policies;
using Domain.Users;
using Domain.Workspaces;
using Infrastructure.IntegrationTests.Fixtures;
using Infrastructure.IntegrationTests.Support;
using Infrastructure.Persistence.EntityFrameworkCore;
using Infrastructure.Persistence.MongoDb;
using Infrastructure.Services;
using MediatR;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using MongoDB.Driver;
using Moq;
using Pg = Infrastructure.Services.EntityFrameworkCore;
using Mongo = Infrastructure.Services.MongoDb;

namespace Infrastructure.IntegrationTests.AuditLogs;

[Collection(FeatBitPostgresCollection.Name)]
public class PostgresIamMemberAuditTests(FeatBitPostgresFixture fixture) : IamMemberAuditParityTests
{
    protected override Rig Create() => new(AppDbContextFactory.Create(fixture.ConnectionString), null);

    [Fact]
    public void SchemaResources_DoNotIncludeLocalMigration()
    {
        var resources = typeof(FeatBitPostgresFixture).Assembly.GetManifestResourceNames();
        Assert.DoesNotContain("FeatBitPostgresInitDb.v6.0.1.sql", resources);
        Assert.Contains("FeatBitPostgresInitDb.vNext.sql", resources);
    }
}

[Collection(MongoCollection.Name)]
public class MongoIamMemberAuditTests(MongoDbFixture fixture) : IamMemberAuditParityTests
{
    protected override Rig Create() => new(null, new MongoDbClient(Options.Create(new MongoDbOptions
    { ConnectionString = fixture.ConnectionString, Database = $"iam-members-{Guid.NewGuid():N}" })));
}

// Identical scenarios exercise both persistence implementations and the real mutation handlers.
public abstract class IamMemberAuditParityTests : IntegrationTestBase
{
    protected abstract Rig Create();

    [DockerFact]
    public async Task MissingResources_PreserveNotFoundAndIdempotentDelete()
    {
        using var rig = Create();
        await rig.Initialize();
        var groupId = Guid.NewGuid();
        var policyId = Guid.NewGuid();
        var updateGroup = new UpdateGroup { Id = groupId, Name = "Missing", Description = "" };
        var groupHandler = new UpdateGroupHandler(rig.Groups, Mock.Of<AutoMapper.IMapper>());
        await Assert.ThrowsAsync<EntityNotFoundException>(() => rig.Run<UpdateGroup, GroupVm>(updateGroup,
            ct => groupHandler.Handle(updateGroup, ct)));
        var updatePolicy = new UpdatePolicySetting { PolicyId = policyId, Name = "Missing", Description = "" };
        var policyHandler = new UpdatePolicySettingHandler(rig.Policies, Mock.Of<AutoMapper.IMapper>());
        await Assert.ThrowsAsync<EntityNotFoundException>(() => rig.Run<UpdatePolicySetting, PolicyVm>(updatePolicy,
            ct => policyHandler.Handle(updatePolicy, ct)));
        var statements = new UpdatePolicyStatements { PolicyId = policyId, Statements = [] };
        var statementHandler = new UpdatePolicyStatementsHandler(rig.Policies, Mock.Of<AutoMapper.IMapper>());
        await Assert.ThrowsAsync<EntityNotFoundException>(() => rig.Run<UpdatePolicyStatements, PolicyVm>(statements,
            ct => statementHandler.Handle(statements, ct)));
        for (var i = 0; i < 2; i++)
        {
            var group = new DeleteGroup { Id = groupId };
            Assert.True(await rig.Run<DeleteGroup, bool>(group, ct => new DeleteGroupHandler(rig.Groups).Handle(group, ct)));
            var policy = new DeletePolicy { PolicyId = policyId };
            Assert.True(await rig.Run<DeletePolicy, bool>(policy, ct => new DeletePolicyHandler(rig.Policies).Handle(policy, ct)));
        }
        Assert.Empty(await rig.Logs());
        Assert.False(rig.Store.Active);
    }

    [DockerTheory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task AddMember_RecordsAssignments_AndSkipsExistingMembership(bool useDefaults)
    {
        using var rig = Create();
        var group = new Group(rig.Org.Id, "Engineering", "") { Id = Guid.NewGuid() };
        var policy = new Policy(rig.Org.Id, "Developer", "developer", "") { Id = Guid.NewGuid() };
        if (useDefaults)
        {
            rig.Org.DefaultPermissions.GroupIds = [group.Id];
            rig.Org.DefaultPermissions.PolicyIds = [policy.Id];
        }
        await rig.Initialize();
        await rig.Seed(group);
        await rig.Seed(policy);
        var request = new AddMember
        {
            WorkspaceId = rig.Workspace.Id, OrganizationId = rig.Org.Id, Email = rig.User.Email,
            GroupIds = useDefaults ? [] : [group.Id], PolicyIds = useDefaults ? [] : [policy.Id]
        };
        var handler = new AddMemberHandler(rig.Workspaces, rig.Organizations, rig.Users,
            Mock.Of<IIdentityService>(MockBehavior.Strict), rig.Actor);
        await rig.Run<AddMember, bool>(request, ct => handler.Handle(request, ct));
        await rig.Run<AddMember, bool>(request, ct => handler.Handle(request, ct));
        var log = Assert.Single(await rig.Logs());
        Assert.Equal(Operations.AddMember, log.Operation);
        Assert.Empty(log.DataChange.Previous);
        Assert.Equal(rig.User.Id.ToString(), log.RefId);
        Assert.Equal(rig.Org.Id, log.OrganizationId);
        Assert.Equal(rig.Workspace.Id, log.WorkspaceId);
        Assert.Equal(rig.Actor.Id, log.CreatorId);
        Assert.Null(log.EnvId);
        using var snapshot = System.Text.Json.JsonDocument.Parse(log.DataChange.Current);
        Assert.Equal(new[] { "email", "groups", "id", "name", "policies", "rn" },
            snapshot.RootElement.EnumerateObject().Select(x => x.Name).Order().ToArray());
        Assert.Equal(group.Id, snapshot.RootElement.GetProperty("groups")[0].GetProperty("id").GetGuid());
        Assert.Equal(policy.Id, snapshot.RootElement.GetProperty("policies")[0].GetProperty("id").GetGuid());
        Assert.DoesNotContain("private-password", log.DataChange.Current);
        Assert.Single(await rig.Store.Read<OrganizationUser>(x => x.OrganizationId == rig.Org.Id && x.UserId == rig.User.Id));
    }

    [DockerTheory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task RemoveFromOrganization_RecordsDeletion_AndNestedWorkspaceRemoval(bool hasOtherOrganization)
    {
        using var rig = Create();
        await rig.Initialize();
        await rig.Seed(new OrganizationUser(rig.Org.Id, rig.User.Id));
        await rig.Seed(new WorkspaceUser(rig.Workspace.Id, rig.User.Id));
        var other = new Organization(rig.Workspace.Id, "Other", Guid.NewGuid().ToString()) { Id = Guid.NewGuid() };
        if (hasOtherOrganization)
        {
            await rig.Seed(other);
            await rig.Seed(new OrganizationUser(other.Id, rig.User.Id));
        }
        var group = new Group(rig.Org.Id, "Engineering", "") { Id = Guid.NewGuid() };
        var policy = new Policy(rig.Org.Id, "Developer", "developer", "") { Id = Guid.NewGuid() };
        await rig.Seed(group);
        await rig.Seed(policy);
        await rig.Seed(new GroupMember(group.Id, rig.Org.Id, rig.User.Id));
        await rig.Seed(new MemberPolicy(rig.Org.Id, rig.User.Id, policy.Id));
        var sender = new Mock<ISender>();
        sender.Setup(x => x.Send(It.IsAny<RemoveFromWorkspace>(), It.IsAny<CancellationToken>()))
            .Returns((RemoveFromWorkspace request, CancellationToken ct) =>
                rig.Run<RemoveFromWorkspace, bool>(request, inner => rig.RemoveWorkspaceHandler.Handle(request, inner)));
        var command = new RemoveFromOrganization { WorkspaceId = rig.Workspace.Id, OrganizationId = rig.Org.Id, MemberId = rig.User.Id };
        var handler = new RemoveFromOrganizationHandler(rig.Organizations, rig.Members, sender.Object);
        await rig.Run<RemoveFromOrganization, bool>(command, ct => handler.Handle(command, ct));
        var logs = await rig.Logs();
        Assert.Equal(hasOtherOrganization ? 1 : 2, logs.Count);
        var deleted = Assert.Single(logs, x => x.OrganizationId == rig.Org.Id);
        Assert.Equal(Operations.RemoveFromOrganization, deleted.Operation);
        Assert.Empty(deleted.DataChange.Current);
        Assert.Contains("group/Engineering", deleted.DataChange.Previous);
        Assert.Contains("policy/developer", deleted.DataChange.Previous);
        if (!hasOtherOrganization)
        {
            var workspaceLog = Assert.Single(logs, x => x.OrganizationId == null);
            Assert.Equal(Operations.RemoveFromWorkspace, workspaceLog.Operation);
            Assert.Equal(rig.Workspace.Id, workspaceLog.WorkspaceId);
            Assert.Empty(workspaceLog.DataChange.Current);
            Assert.Contains(rig.User.Email, workspaceLog.DataChange.Previous);
        }
        Assert.Empty(await rig.Store.Read<OrganizationUser>(x => x.OrganizationId == rig.Org.Id && x.UserId == rig.User.Id));
        Assert.Empty(await rig.Store.Read<GroupMember>(x => x.OrganizationId == rig.Org.Id && x.MemberId == rig.User.Id));
        Assert.Empty(await rig.Store.Read<MemberPolicy>(x => x.OrganizationId == rig.Org.Id && x.MemberId == rig.User.Id));
        Assert.Equal(hasOtherOrganization ? 1 : 0, (await rig.Store.Read<User>(x => x.Id == rig.User.Id)).Count);
        Assert.Equal(hasOtherOrganization ? 1 : 0, (await rig.Store.Read<WorkspaceUser>(x => x.WorkspaceId == rig.Workspace.Id && x.UserId == rig.User.Id)).Count);
        sender.Verify(x => x.Send(It.IsAny<RemoveFromWorkspace>(), It.IsAny<CancellationToken>()),
            hasOtherOrganization ? Times.Never() : Times.Once());
    }

    [DockerTheory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task RemoveFromWorkspace_RequiresOtherOrganizationPermission_AndPreservesOtherWorkspace(bool allowed)
    {
        using var rig = Create();
        await rig.Initialize();
        var other = new Organization(rig.Workspace.Id, "Other", Guid.NewGuid().ToString()) { Id = Guid.NewGuid() };
        var foreignWorkspace = new Workspace { Id = Guid.NewGuid(), Name = "Foreign", Key = Guid.NewGuid().ToString(), License = "" };
        var foreignOrg = new Organization(foreignWorkspace.Id, "Foreign", Guid.NewGuid().ToString()) { Id = Guid.NewGuid() };
        await rig.Seed(other);
        await rig.Seed(foreignWorkspace);
        await rig.Seed(foreignOrg);
        foreach (var org in new[] { rig.Org, other, foreignOrg })
            await rig.Seed(new OrganizationUser(org.Id, rig.User.Id));
        await rig.Seed(new WorkspaceUser(rig.Workspace.Id, rig.User.Id));
        await rig.Seed(new WorkspaceUser(foreignWorkspace.Id, rig.User.Id));
        if (allowed)
        {
            await rig.Seed(new OrganizationUser(other.Id, rig.Actor.Id));
            var grant = new Policy(other.Id, "IAM", "iam", "")
            { Statements = [new PolicyStatement { Id = "iam", ResourceType = "iam", Effect = "allow", Actions = [Permissions.CanManageIAM], Resources = ["iam/*"] }] };
            await rig.Seed(grant);
            await rig.Seed(new MemberPolicy(other.Id, rig.Actor.Id, grant.Id));
        }
        var command = new RemoveFromWorkspace { WorkspaceId = rig.Workspace.Id, MemberId = rig.User.Id };
        Task<bool> Run() => rig.Run<RemoveFromWorkspace, bool>(command, ct => rig.RemoveWorkspaceHandler.Handle(command, ct));
        if (allowed)
        {
            Assert.True(await Run());
            var logs = await rig.Logs();
            Assert.Equal(3, logs.Count);
            Assert.All(logs, x => { Assert.Equal(rig.Workspace.Id, x.WorkspaceId); Assert.Equal(Operations.RemoveFromWorkspace, x.Operation); Assert.Empty(x.DataChange.Current); });
            Assert.Equal(new Guid?[] { null, rig.Org.Id, other.Id }.Order(), logs.Select(x => x.OrganizationId).Order());
            Assert.Empty(await rig.Store.Read<OrganizationUser>(x => x.UserId == rig.User.Id && (x.OrganizationId == rig.Org.Id || x.OrganizationId == other.Id)));
            Assert.Empty(await rig.Store.Read<WorkspaceUser>(x => x.WorkspaceId == rig.Workspace.Id && x.UserId == rig.User.Id));
        }
        else
        {
            await Assert.ThrowsAsync<ForbiddenException>(Run);
            Assert.Empty(await rig.Logs());
            Assert.Equal(3, (await rig.Store.Read<OrganizationUser>(x => x.UserId == rig.User.Id)).Count);
            Assert.Single(await rig.Store.Read<WorkspaceUser>(x => x.WorkspaceId == rig.Workspace.Id && x.UserId == rig.User.Id));
        }
        Assert.Single(await rig.Store.Read<OrganizationUser>(x => x.OrganizationId == foreignOrg.Id && x.UserId == rig.User.Id));
        Assert.Single(await rig.Store.Read<WorkspaceUser>(x => x.WorkspaceId == foreignWorkspace.Id && x.UserId == rig.User.Id));
        Assert.Single(await rig.Store.Read<User>(x => x.Id == rig.User.Id));
    }

    protected sealed class Rig : IDisposable
    {
        private readonly AppDbContext? db;
        private readonly MongoDbClient? mongo;
        private readonly ServiceProvider services;
        private readonly HttpContextAccessor http;
        public Workspace Workspace { get; } = new() { Id = Guid.NewGuid(), Name = "Audit", Key = Guid.NewGuid().ToString(), License = "" };
        public Organization Org { get; }
        public User User { get; } = new(Guid.NewGuid(), $"member-{Guid.NewGuid():N}@example.com", "private-password", "Member");
        public ICurrentUser Actor { get; } = Mock.Of<ICurrentUser>(x => x.Id == Guid.NewGuid());
        public AuditStore Store { get; }
        public IGroupService Groups { get; }
        public IPolicyService Policies { get; }
        public IOrganizationService Organizations { get; }
        public IWorkspaceService Workspaces { get; }
        public IUserService Users { get; }
        public IMemberService Members { get; }
        private IAuditLogService AuditLogs { get; }
        public RemoveFromWorkspaceHandler RemoveWorkspaceHandler => new(Workspaces, Users, Organizations, Members);

        public Rig(AppDbContext? db, MongoDbClient? mongo)
        {
            this.db = db;
            this.mongo = mongo;
            Org = new Organization(Workspace.Id, "Audit", Guid.NewGuid().ToString()) { Id = Guid.NewGuid() };
            Groups = db != null ? new Pg.GroupService(db) : new Mongo.GroupService(mongo!);
            Policies = db != null ? new Pg.PolicyService(db) : new Mongo.PolicyService(mongo!);
            Organizations = db != null ? new Pg.OrganizationService(db, Mock.Of<IProjectService>()) : new Mongo.OrganizationService(mongo!, Mock.Of<IProjectService>());
            Workspaces = db != null ? new Pg.WorkspaceService(db) : new Mongo.WorkspaceService(mongo!);
            Users = db != null ? new Pg.UserService(db) : new Mongo.UserService(mongo!);
            Members = db != null ? new Pg.MemberService(db) : new Mongo.MemberService(mongo!);
            AuditLogs = db != null ? new Pg.AuditLogService(db) : new Mongo.AuditLogService(mongo!);
            var collection = new ServiceCollection().AddSingleton(Members);
            if (db != null) collection.AddSingleton(db); else collection.AddSingleton(mongo!);
            services = collection.BuildServiceProvider();
            Store = new AuditStore(services);
            var context = new DefaultHttpContext { RequestServices = services };
            context.Request.Headers["Organization"] = Org.Id.ToString();
            context.Request.Headers["Workspace"] = Workspace.Id.ToString();
            http = new HttpContextAccessor { HttpContext = context };
        }

        public async Task Initialize()
        {
            await Seed(Workspace);
            await Seed(Org);
            await Seed(User);
            await Seed(new User(Actor.Id, $"actor-{Actor.Id}@example.com", "password", "Actor"));
        }

        public async Task Seed<T>(T entity) where T : Entity
        {
            if (db != null) { db.Add(entity); await db.SaveChangesAsync(); }
            else await mongo!.CollectionOf<T>().InsertOneAsync(entity);
        }
        public Task<List<AuditLog>> Logs() => Store.Read<AuditLog>(x => x.WorkspaceId == Workspace.Id);
        public Task<T> Run<TRequest, T>(TRequest request, RequestHandlerDelegate<T> next) where TRequest : notnull =>
            new IamAuditBehaviour<TRequest, T>(Store, AuditLogs, Actor, http).Handle(request, next, CancellationToken.None);
        public void Dispose() { services.Dispose(); db?.Dispose(); }
    }
}

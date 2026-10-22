using Application.AuditLogs;
using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
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
using MediatR;
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
        var groupHandler = new UpdateGroupHandler(rig.Groups, Mock.Of<AutoMapper.IMapper>(), rig.Publisher, rig.Actor);
        await Assert.ThrowsAsync<EntityNotFoundException>(() => rig.Run<UpdateGroup, GroupVm>(updateGroup,
            ct => groupHandler.Handle(updateGroup, ct)));
        var updatePolicy = new UpdatePolicySetting { PolicyId = policyId, Name = "Missing", Description = "" };
        var policyHandler = new UpdatePolicySettingHandler(rig.Policies, Mock.Of<AutoMapper.IMapper>(), rig.Publisher, rig.Actor);
        await Assert.ThrowsAsync<EntityNotFoundException>(() => rig.Run<UpdatePolicySetting, PolicyVm>(updatePolicy,
            ct => policyHandler.Handle(updatePolicy, ct)));
        var statements = new UpdatePolicyStatements { PolicyId = policyId, Statements = [] };
        var statementHandler = new UpdatePolicyStatementsHandler(rig.Policies, Mock.Of<AutoMapper.IMapper>(), rig.Publisher, rig.Actor);
        await Assert.ThrowsAsync<EntityNotFoundException>(() => rig.Run<UpdatePolicyStatements, PolicyVm>(statements,
            ct => statementHandler.Handle(statements, ct)));
        for (var i = 0; i < 2; i++)
        {
            var group = new DeleteGroup { Id = groupId };
            Assert.True(await rig.Run<DeleteGroup, bool>(group, ct => new DeleteGroupHandler(rig.Groups, rig.Publisher, rig.Actor).Handle(group, ct)));
            var policy = new DeletePolicy { PolicyId = policyId };
            Assert.True(await rig.Run<DeletePolicy, bool>(policy, ct => new DeletePolicyHandler(rig.Policies, rig.Publisher, rig.Actor).Handle(policy, ct)));
        }
        Assert.Empty(await rig.Logs());
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
            Mock.Of<IIdentityService>(MockBehavior.Strict), rig.Actor, rig.Members, rig.Publisher);
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
        Assert.Single(await rig.Read<OrganizationUser>(x => x.OrganizationId == rig.Org.Id && x.UserId == rig.User.Id));
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
        var handler = new RemoveFromOrganizationHandler(rig.Organizations, rig.Members, sender.Object, rig.Publisher, rig.Actor);
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
        Assert.Empty(await rig.Read<OrganizationUser>(x => x.OrganizationId == rig.Org.Id && x.UserId == rig.User.Id));
        Assert.Empty(await rig.Read<GroupMember>(x => x.OrganizationId == rig.Org.Id && x.MemberId == rig.User.Id));
        Assert.Empty(await rig.Read<MemberPolicy>(x => x.OrganizationId == rig.Org.Id && x.MemberId == rig.User.Id));
        Assert.Equal(hasOtherOrganization ? 1 : 0, (await rig.Read<User>(x => x.Id == rig.User.Id)).Count);
        Assert.Equal(hasOtherOrganization ? 1 : 0, (await rig.Read<WorkspaceUser>(x => x.WorkspaceId == rig.Workspace.Id && x.UserId == rig.User.Id)).Count);
        sender.Verify(x => x.Send(It.IsAny<RemoveFromWorkspace>(), It.IsAny<CancellationToken>()),
            hasOtherOrganization ? Times.Never() : Times.Once());
    }

    [DockerTheory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task RemoveFromWorkspace_RecordsEveryOrganization_WithoutExtraPermissionChecks(bool allowed)
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
        Assert.True(await Run());
        var logs = await rig.Logs();
        Assert.Equal(3, logs.Count);
        Assert.All(logs, x => { Assert.Equal(rig.Workspace.Id, x.WorkspaceId); Assert.Equal(Operations.RemoveFromWorkspace, x.Operation); Assert.Empty(x.DataChange.Current); });
        Assert.Equal(new Guid?[] { null, rig.Org.Id, other.Id }.Order(), logs.Select(x => x.OrganizationId).Order());
        Assert.Empty(await rig.Read<OrganizationUser>(x => x.UserId == rig.User.Id && (x.OrganizationId == rig.Org.Id || x.OrganizationId == other.Id)));
        Assert.Empty(await rig.Read<WorkspaceUser>(x => x.WorkspaceId == rig.Workspace.Id && x.UserId == rig.User.Id));
        Assert.Single(await rig.Read<OrganizationUser>(x => x.OrganizationId == foreignOrg.Id && x.UserId == rig.User.Id));
        Assert.Single(await rig.Read<WorkspaceUser>(x => x.WorkspaceId == foreignWorkspace.Id && x.UserId == rig.User.Id));
        Assert.Single(await rig.Read<User>(x => x.Id == rig.User.Id));
    }

    [DockerTheory]
    [InlineData(PolicyTypes.CustomerManaged, "customer-managed")]
    [InlineData(PolicyTypes.SysManaged, "system-managed")]
    public async Task ClonePolicy_UsesExplicitNotificationAndTypedComment(string sourceType, string label)
    {
        using var rig = Create();
        await rig.Initialize();
        var key = $"source-{Guid.NewGuid():N}";
        var customer = new Policy(rig.Org.Id, "Customer", key, "");
        var system = new Policy(rig.Org.Id, "System", key, "") { OrganizationId = null, Type = PolicyTypes.SysManaged };
        await rig.Seed(customer);
        await rig.Seed(system);
        var result = await rig.Send(new ClonePolicy
        {
            OriginPolicyType = sourceType, OriginPolicyKey = key,
            Name = "Clone", Key = $"clone-{Guid.NewGuid():N}", Description = ""
        });
        var log = Assert.Single(await rig.Logs());
        Assert.Equal($"Cloned from: {label} policy/{key}", log.Comment);
        Assert.Equal(result.Id, log.RefId);
        Assert.Equal(Operations.ClonePolicy, log.Operation);
        Assert.Empty(log.DataChange.Previous);
        Assert.DoesNotContain("clonedFrom", System.Text.Json.JsonSerializer.Serialize(log.DataChange));
    }

    [DockerFact]
    public async Task Profile_RecordsAllWorkspacesAndOrganizations_WithoutCredentialsOrDuplicateNoOps()
    {
        using var rig = Create();
        await rig.Initialize();
        var second = new Organization(rig.Workspace.Id, "Second", Guid.NewGuid().ToString());
        var other = new Organization(Guid.NewGuid(), "Other workspace", Guid.NewGuid().ToString());
        var workspaceOnly = Guid.NewGuid();
        await rig.Seed(second);
        await rig.Seed(other);
        await rig.Seed(new Workspace { Id = other.WorkspaceId, Name = "Other", Key = Guid.NewGuid().ToString(), License = "" });
        await rig.Seed(new Workspace { Id = workspaceOnly, Name = "Workspace only", Key = Guid.NewGuid().ToString(), License = "" });
        foreach (var org in new[] { rig.Org, second, other })
            await rig.Seed(new OrganizationUser(org.Id, rig.Actor.Id));
        foreach (var workspaceId in new[] { rig.Workspace.Id, other.WorkspaceId, workspaceOnly })
            await rig.Seed(new WorkspaceUser(workspaceId, rig.Actor.Id));
        var command = new UpdateProfile { Name = "Updated", Email = $"updated-{Guid.NewGuid():N}@example.com" };
        await rig.Send(command);
        await rig.Send(command);
        var logs = await rig.Read<AuditLog>(x => x.RefId == rig.Actor.Id.ToString() && x.Operation == Operations.UpdateProfile);
        Assert.Equal(4, logs.Count);
        Assert.Contains(logs, x => x.OrganizationId == rig.Org.Id && x.WorkspaceId == rig.Workspace.Id);
        Assert.Contains(logs, x => x.OrganizationId == second.Id && x.WorkspaceId == rig.Workspace.Id);
        Assert.Contains(logs, x => x.OrganizationId == other.Id && x.WorkspaceId == other.WorkspaceId);
        Assert.Contains(logs, x => x.OrganizationId == null && x.WorkspaceId == workspaceOnly);
        Assert.All(logs, x =>
        {
            Assert.Contains(command.Email, x.DataChange.Current);
            Assert.DoesNotContain("password", x.DataChange.Previous, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("password", x.DataChange.Current, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("private-initial-secret", x.DataChange.Previous + x.DataChange.Current);
            foreach (var json in new[] { x.DataChange.Previous, x.DataChange.Current })
            {
                using var snapshot = System.Text.Json.JsonDocument.Parse(json);
                Assert.Equal(new[] { "email", "id", "name", "rn" },
                    snapshot.RootElement.EnumerateObject().Select(p => p.Name).Order());
                Assert.Equal(rig.Actor.Id, snapshot.RootElement.GetProperty("id").GetGuid());
                Assert.Equal($"member/{snapshot.RootElement.GetProperty("email").GetString()}",
                    snapshot.RootElement.GetProperty("rn").GetString());
            }
        });
    }

    [DockerFact]
    public async Task PolicyReferences_PreserveRnAndDistinguishTypesWithTheSameKey()
    {
        using var rig = Create();
        await rig.Initialize();
        await rig.Seed(new OrganizationUser(rig.Org.Id, rig.User.Id));
        var key = $"shared-key-{Guid.NewGuid():N}";
        var customer = new Policy(rig.Org.Id, "Customer", key, "");
        var system = new Policy(rig.Org.Id, "System", key, "")
            { OrganizationId = null, Type = PolicyTypes.SysManaged };
        var group = new Group(rig.Org.Id, "Group", "");
        await rig.Seed(customer);
        await rig.Seed(system);
        await rig.Seed(group);
        await rig.Seed(new GroupPolicy(group.Id, customer.Id));
        await rig.Seed(new GroupPolicy(group.Id, system.Id));
        await rig.Send(new UpdateGroup { Id = group.Id, Name = "Renamed", Description = "" });
        await rig.Send(new AddMemberPolicy { MemberId = rig.User.Id, PolicyId = customer.Id });
        await rig.Send(new AddMemberPolicy { MemberId = rig.User.Id, PolicyId = system.Id });

        var logs = await rig.Logs();
        var groupLog = Assert.Single(logs, x => x.Operation == Operations.UpdateGroup);
        var memberLog = Assert.Single(logs, x => x.Operation == Operations.AddMemberPolicy &&
            x.DataChange.Current.Contains(system.Id.ToString()));
        foreach (var json in new[] { groupLog.DataChange.Previous, groupLog.DataChange.Current, memberLog.DataChange.Current })
        {
            using var snapshot = System.Text.Json.JsonDocument.Parse(json);
            var policies = snapshot.RootElement.GetProperty("policies").EnumerateArray().ToArray();
            Assert.Equal(2, policies.Length);
            Assert.All(policies, x => Assert.Equal($"policy/{key}", x.GetProperty("rn").GetString()));
            Assert.Contains(policies, x => x.GetProperty("id").GetGuid() == customer.Id &&
                x.GetProperty("type").GetString() == PolicyTypes.CustomerManaged);
            Assert.Contains(policies, x => x.GetProperty("id").GetGuid() == system.Id &&
                x.GetProperty("type").GetString() == PolicyTypes.SysManaged);
        }
    }

    [DockerFact]
    public async Task GroupAndPolicyMutations_PublishAuditNotifications_AndSkipNoOps()
    {
        using var rig = Create();
        await rig.Initialize();
        await rig.Seed(new OrganizationUser(rig.Org.Id, rig.User.Id));
        var group = await rig.Send(new CreateGroup { Name = "Group", Description = "" });
        var groupId = Guid.Parse(group.Id);
        await rig.Send(new UpdateGroup { Id = groupId, Name = "Renamed", Description = "description" });
        await rig.Send(new AddGroupMember { GroupId = groupId, MemberId = rig.User.Id });
        await rig.Send(new AddGroupMember { GroupId = groupId, MemberId = rig.User.Id });
        await rig.Send(new RemoveGroupMember { GroupId = groupId, MemberId = rig.User.Id });
        var policy = await rig.Send(new CreatePolicy { Name = "Policy", Key = $"key-{Guid.NewGuid():N}", Description = "" });
        var policyId = Guid.Parse(policy.Id);
        await rig.Send(new UpdatePolicySetting { PolicyId = policyId, Name = "Renamed policy", Description = "updated" });
        await rig.Send(new UpdatePolicyStatements { PolicyId = policyId, Statements = [new PolicyStatement
        { Id = "statement", ResourceType = "flag", Effect = "allow", Actions = ["ToggleFlag"], Resources = ["project/*"] }] });
        await rig.Send(new AddGroupPolicy { GroupId = groupId, PolicyId = policyId });
        await rig.Send(new RemoveGroupPolicy { GroupId = groupId, PolicyId = policyId });
        await rig.Send(new AddMemberPolicy { MemberId = rig.User.Id, PolicyId = policyId });
        await rig.Send(new RemoveMemberPolicy { MemberId = rig.User.Id, PolicyId = policyId });
        await rig.Send(new DeletePolicy { PolicyId = policyId });
        await rig.Send(new DeleteGroup { Id = groupId });
        var logs = await rig.Logs();
        var operations = new[] { Operations.CreateGroup, Operations.UpdateGroup, Operations.AddGroupMember,
            Operations.RemoveGroupMember, Operations.CreatePolicy, Operations.UpdatePolicySetting,
            Operations.UpdatePolicyStatements, Operations.AddGroupPolicy, Operations.RemoveGroupPolicy,
            Operations.AddMemberPolicy, Operations.RemoveMemberPolicy, Operations.DeletePolicy, Operations.DeleteGroup };
        Assert.Equal(operations.Order(), logs.Select(x => x.Operation).Order());
        Assert.All(logs, x =>
        {
            Assert.Equal(rig.Workspace.Id, x.WorkspaceId);
            Assert.Equal(rig.Org.Id, x.OrganizationId);
            Assert.Equal(rig.Actor.Id, x.CreatorId);
            Assert.Null(x.EnvId);
            Assert.DoesNotContain("password", x.DataChange.Previous + x.DataChange.Current, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("private-initial-secret", x.DataChange.Previous + x.DataChange.Current);
        });
        Assert.Contains(logs, x => x.Operation == Operations.AddGroupMember && x.DataChange.Current.Contains(rig.User.Email));
        Assert.Contains(logs, x => x.Operation == Operations.DeleteGroup && x.DataChange.Current == "" && x.DataChange.Previous.Contains("Renamed"));
    }

    [DockerFact]
    public async Task AuditWriteFailure_PropagatesWithoutRollingBackSavedMutation()
    {
        using var rig = Create();
        await rig.Initialize();
        var publisher = new Mock<IPublisher>();
        publisher.Setup(x => x.Publish(It.IsAny<OnIamResourceChanged>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("audit unavailable"));
        var mapper = new AutoMapper.MapperConfiguration(c => c.AddProfile<Application.Groups.MapperProfile>()).CreateMapper();
        var handler = new CreateGroupHandler(rig.Groups, mapper, publisher.Object, rig.Actor);
        var request = new CreateGroup { WorkspaceId = rig.Workspace.Id, OrganizationId = rig.Org.Id, Name = "Saved", Description = "" };
        await Assert.ThrowsAsync<InvalidOperationException>(() => handler.Handle(request, default));
        Assert.Single(await rig.Read<Group>(x => x.OrganizationId == rig.Org.Id && x.Name == "Saved"));
        Assert.Empty(await rig.Logs());
    }

    protected sealed class Rig : IDisposable
    {
        private readonly AppDbContext? db;
        private readonly MongoDbClient? mongo;
        private readonly ServiceProvider services;
        public Workspace Workspace { get; } = new() { Id = Guid.NewGuid(), Name = "Audit", Key = Guid.NewGuid().ToString(), License = "" };
        public Organization Org { get; }
        public User User { get; } = new(Guid.NewGuid(), $"member-{Guid.NewGuid():N}@example.com", "private-password", "Member", initialPassword: "private-initial-secret");
        public ICurrentUser Actor { get; } = Mock.Of<ICurrentUser>(x => x.Id == Guid.NewGuid());
        public IPublisher Publisher { get; }
        public IGroupService Groups { get; }
        public IPolicyService Policies { get; }
        public IOrganizationService Organizations { get; }
        public IWorkspaceService Workspaces { get; }
        public IUserService Users { get; }
        public IMemberService Members { get; }
        private IAuditLogService AuditLogs { get; }
        public RemoveFromWorkspaceHandler RemoveWorkspaceHandler => new(Workspaces, Users, Organizations, Members, Publisher, Actor);

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
            var collection = new ServiceCollection().AddSingleton(Members)
                .AddSingleton(Groups).AddSingleton(Policies).AddSingleton(Organizations)
                .AddSingleton(Workspaces).AddSingleton(Users).AddSingleton(AuditLogs).AddSingleton(Actor)
                .AddSingleton(Mock.Of<IIdentityService>());
            collection.AddAutoMapper(typeof(Application.Groups.MapperProfile).Assembly);
            collection.AddMediatR(c => c.RegisterServicesFromAssembly(typeof(OnIamResourceChanged).Assembly));
            services = collection.BuildServiceProvider();
            Publisher = services.GetRequiredService<IPublisher>();
        }

        public async Task Initialize()
        {
            await Seed(Workspace);
            await Seed(Org);
            await Seed(User);
            await Seed(new User(Actor.Id, $"actor-{Actor.Id}@example.com", "private-password", "Actor", initialPassword: "private-initial-secret"));
        }

        public async Task Seed<T>(T entity) where T : Entity
        {
            if (db != null) { db.Add(entity); await db.SaveChangesAsync(); }
            else await mongo!.CollectionOf<T>().InsertOneAsync(entity);
        }
        public Task<List<AuditLog>> Logs() => Read<AuditLog>(x => x.WorkspaceId == Workspace.Id);
        public Task<T> Send<T>(IRequest<T> request)
        {
            // Each call represents a new HTTP request with a fresh tracking scope.
            db?.ChangeTracker.Clear();
            SetContext(request);
            return services.GetRequiredService<ISender>().Send(request);
        }

        private void SetContext(object request)
        {
            request.GetType().GetProperty("WorkspaceId")?.SetValue(request, Workspace.Id);
            request.GetType().GetProperty("OrganizationId")?.SetValue(request, Org.Id);
            request.GetType().GetProperty("OrgId")?.SetValue(request, Org.Id);
        }
        public Task<T> Run<TRequest, T>(TRequest request, RequestHandlerDelegate<T> next) where TRequest : notnull
        {
            db?.ChangeTracker.Clear();
            request.GetType().GetProperty("WorkspaceId")?.SetValue(request, Workspace.Id);
            request.GetType().GetProperty("OrganizationId")?.SetValue(request, Org.Id);
            request.GetType().GetProperty("OrgId")?.SetValue(request, Org.Id);
            return next();
        }

        public Task<List<T>> Read<T>(Expression<Func<T, bool>> predicate) where T : Entity => db != null
            ? db.Set<T>().AsNoTracking().Where(predicate).ToListAsync()
            : MongoDB.Driver.Linq.MongoQueryable.ToListAsync(mongo!.QueryableOf<T>().Where(predicate));

        public void Dispose() { services.Dispose(); db?.Dispose(); }
    }
}

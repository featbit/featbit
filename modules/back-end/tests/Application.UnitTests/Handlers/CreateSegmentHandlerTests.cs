using System.Linq.Expressions;
using Application.Bases.Exceptions;
using Application.Segments;
using Application.Services;
using Application.Users;
using Domain.AuditLogs;
using Domain.Workspaces;
using MediatR;
using Domain.Organizations;
using Domain.Projects;
using Domain.Policies;
using Domain.Resources;
using Domain.Segments;
using Environment = Domain.Environments.Environment;

namespace Application.UnitTests.Handlers;

public class CreateSegmentHandlerTests
{
    [Theory]
    [InlineData("organization/o")]
    [InlineData("organization/o:project/p")]
    [InlineData("organization/o:project/p:env/e")]
    public async Task CrossOrganizationSharingUsesTargetOrganizationPermissions(string scope)
    {
        var f = new Fixture();
        await f.CreateAsync(f.Request(scope));
        f.Permissions.Verify(x => x.GetAsync(f.Org.Id), Times.Once);
        f.Permissions.Verify(x => x.GetAsync(f.RequestOrg), Times.Never);
    }

    [Theory]
    [InlineData("org")]
    [InlineData("project")]
    [InlineData("env")]
    [InlineData("workspace")]
    [InlineData("no-permission")]
    [InlineData("no-access")]
    [InlineData("deny")]
    public async Task RejectsMissingScopeOrTargetPermissions(string failure)
    {
        var f = new Fixture(failure);
        await f.AssertForbiddenAsync(f.Request("organization/o:project/p:env/e"));
    }

    [Theory]
    [InlineData("deny")]
    [InlineData("wildcard-deny")]
    public async Task BroadScopeCannotBypassNarrowEnvironmentDeny(string failure)
    {
        var f = new Fixture(failure);
        await f.AssertForbiddenAsync(f.Request("organization/o"));
    }

    public static IEnumerable<object[]> TaggedDenyCases =>
        from scope in new[] { "organization/o", "organization/o:project/p", "organization/o:project/p:env/e" }
        from action in new[] { Domain.Policies.Permissions.CreateSegment, "*" }
        from tag in new[] { "protected", "prot*", "*" }
        select new object[] { scope, action, tag };

    [Theory]
    [MemberData(nameof(TaggedDenyCases))]
    public async Task TaggedDenyDoesNotRejectUntaggedNewSegment(string scope, string action, string tag)
    {
        var f = new Fixture(deny: Deny(action, $"project/p:env/e:segment/s;{tag}"));
        await f.CreateAsync(f.Request(scope));
    }

    public static IEnumerable<object[]> IntersectingDenyCases =>
        from scope in new[] { "organization/o", "organization/o:project/p", "organization/o:project/p:env/e" }
        from action in new[] { Domain.Policies.Permissions.CanAccessEnv, Domain.Policies.Permissions.CreateSegment, "*" }
        from wildcard in new[] { false, true }
        let envPattern = wildcard ? "project/p*:env/e*" : "project/p:env/e"
        let pattern = action == Domain.Policies.Permissions.CanAccessEnv ? envPattern : envPattern + ":segment/s"
        select new object[] { scope, action, pattern };

    [Theory]
    [MemberData(nameof(IntersectingDenyCases))]
    public async Task IntersectingUntaggedDenyRejectsScope(string scope, string action, string pattern)
    {
        var f = new Fixture(deny: Deny(action, pattern));
        await f.AssertForbiddenAsync(f.Request(scope));
    }

    [Theory]
    [InlineData("organization/o:project/p", "project/q:env/e:segment/s")]
    [InlineData("organization/o:project/p", "project/q*:env/e*:segment/s")]
    [InlineData("organization/o:project/p:env/e", "project/p:env/other:segment/s")]
    [InlineData("organization/o:project/p:env/e", "project/p:env/other*:segment/s")]
    [InlineData("organization/o", "project/p:env/e:segment/other")]
    [InlineData("organization/o:project/p", "project/p:env/e:segment/other*")]
    public async Task UnrelatedResourceDenyDoesNotRejectScope(string scope, string pattern)
    {
        var f = new Fixture(deny: Deny("*", pattern));
        await f.CreateAsync(f.Request(scope));
    }

    [Fact]
    public async Task UnrelatedActionDenyDoesNotRejectScope()
    {
        var f = new Fixture(deny: Deny(Domain.Policies.Permissions.UpdateSegmentName, "project/p:env/e:segment/s"));
        await f.CreateAsync(f.Request("organization/o"));
    }

    [Fact]
    public async Task TaggedDenyDoesNotHideAnotherMatchingUntaggedDeny()
    {
        var deny = Deny(Domain.Policies.Permissions.CreateSegment, "project/p:env/e:segment/s;protected");
        deny.Resources = [deny.Resources.First(), "project/p:env/e:segment/s"];
        var f = new Fixture(deny: deny);
        await f.AssertForbiddenAsync(f.Request("organization/o:project/p"));
    }

    private static PolicyStatement Deny(string action, string pattern) => new()
    {
        ResourceType = action == Domain.Policies.Permissions.CanAccessEnv ? ResourceTypes.Env : ResourceTypes.Segment,
        Effect = EffectType.Deny, Actions = [action], Resources = [pattern]
    };

    [Fact]
    public async Task EveryScopeMustBeAuthorized()
    {
        var f = new Fixture();
        var request = f.Request("organization/o:project/p:env/e");
        request.Scopes = [request.Scopes[0], "organization/missing"];
        await f.AssertForbiddenAsync(request);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task EnvironmentSpecificScopeMustMatchRoute(bool matching)
    {
        var f = new Fixture();
        var request = f.Request("organization/o:project/p:env/e");
        request.Type = SegmentType.EnvironmentSpecific;
        request.OrgId = f.Org.Id;
        request.EnvId = matching ? f.Env.Id : Guid.NewGuid();
        if (matching) await f.CreateAsync(request);
        else await f.AssertForbiddenAsync(request);
    }

    [Fact]
    public async Task SharedSegmentRequiresLicenseBeforeAuthorizationOrWrites()
    {
        var f = new Fixture();
        await f.AssertLicenseDeniedAsync(f.Request("organization/o"));
    }

    private sealed class Fixture
    {
        public Guid Workspace { get; } = Guid.NewGuid();
        public Guid RequestOrg { get; } = Guid.NewGuid();
        public Organization Org { get; }
        public Environment Env { get; }
        private CreateSegmentHandler Handler { get; }
        public Mock<ISegmentService> Segments { get; } = new();
        public Mock<IPublisher> Publisher { get; } = new();
        public Mock<ILicenseService> License { get; } = new();
        public Mock<IOrganizationPermissions> Permissions { get; } = new();
        public Fixture(string failure = "", PolicyStatement? deny = null)
        {
            Org = new(failure == "workspace" ? Guid.NewGuid() : Workspace, "Org", "o") { Id = Guid.NewGuid() };
            var project = new Project(Org.Id, "Project", "p") { Id = Guid.NewGuid() };
            Env = new(project.Id, "Env", "e") { Id = Guid.NewGuid() };
            var orgs = new Mock<IOrganizationService>();
            orgs.Setup(x => x.FindOneAsync(It.IsAny<Expression<Func<Organization, bool>>>()))
                .ReturnsAsync((Expression<Func<Organization, bool>> p) => failure != "org" && p.Compile()(Org) ? Org : null);
            var projects = new Mock<IProjectService>();
            projects.Setup(x => x.FindOneAsync(It.IsAny<Expression<Func<Project, bool>>>()))
                .ReturnsAsync((Expression<Func<Project, bool>> p) => failure != "project" && p.Compile()(project) ? project : null);
            var envs = new Mock<IEnvironmentService>();
            envs.Setup(x => x.FindOneAsync(It.IsAny<Expression<Func<Environment, bool>>>()))
                .ReturnsAsync((Expression<Func<Environment, bool>> p) => failure != "env" && p.Compile()(Env) ? Env : null);
            var policies = new List<PolicyStatement>();
            if (failure != "no-access") policies.Add(new() { ResourceType = ResourceTypes.Env,
                Effect = EffectType.Allow, Resources = ["project/*:env/*"], Actions = [Domain.Policies.Permissions.CanAccessEnv] });
            if (failure != "no-permission") policies.Add(new() { ResourceType = ResourceTypes.Segment,
                Effect = EffectType.Allow, Resources = ["project/*:env/*:segment/*"], Actions = [Domain.Policies.Permissions.CreateSegment] });
            if (failure is "deny" or "wildcard-deny") policies.Add(new() { ResourceType = ResourceTypes.Env,
                Effect = EffectType.Deny, Resources = [failure == "wildcard-deny" ? "project/p*:env/e*" : "project/p:env/e"], Actions = [Domain.Policies.Permissions.CanAccessEnv] });
            if (deny != null) policies.Add(deny);
            Permissions.Setup(x => x.GetAsync(Org.Id)).ReturnsAsync(policies.ToArray());
            License.Setup(x => x.IsFeatureGrantedAsync(Workspace, LicenseFeatures.ShareableSegment)).ReturnsAsync(true);
            Handler = new(Segments.Object, License.Object, Publisher.Object, Mock.Of<ICurrentUser>(),
                orgs.Object, projects.Object, envs.Object, Permissions.Object);
        }
        public async Task CreateAsync(CreateSegment request)
        {
            var segment = await Handler.Handle(request, CancellationToken.None);
            Assert.Equal(request.WorkspaceId, segment.WorkspaceId);
            Assert.Equal(request.EnvId, segment.EnvId);
            Assert.Equal(request.Scopes, segment.Scopes);
            Assert.Empty(segment.Tags);
            Segments.Verify(x => x.AddOneAsync(segment), Times.Once);
            Publisher.Verify(x => x.Publish(It.Is<OnSegmentChange>(n =>
                n.Segment == segment && n.OrganizationId == request.OrgId &&
                n.WorkspaceId == request.WorkspaceId && n.Operation == Operations.Create),
                It.IsAny<CancellationToken>()), Times.Once);
        }

        public async Task AssertForbiddenAsync(CreateSegment request)
        {
            await Assert.ThrowsAsync<ForbiddenException>(() => Handler.Handle(request, CancellationToken.None));
            Segments.VerifyNoOtherCalls();
            Publisher.VerifyNoOtherCalls();
        }

        public async Task AssertLicenseDeniedAsync(CreateSegment request)
        {
            License.Setup(x => x.IsFeatureGrantedAsync(Workspace, LicenseFeatures.ShareableSegment)).ReturnsAsync(false);
            await Assert.ThrowsAsync<BusinessException>(() => Handler.Handle(request, CancellationToken.None));
            Permissions.VerifyNoOtherCalls();
            Segments.VerifyNoOtherCalls();
            Publisher.VerifyNoOtherCalls();
        }

        public CreateSegment Request(string scope) => new()
        { WorkspaceId = Workspace, OrgId = RequestOrg, EnvId = Guid.NewGuid(), Name = "Segment", Key = "s", Type = SegmentType.Shared, Scopes = [scope] };
    }
}

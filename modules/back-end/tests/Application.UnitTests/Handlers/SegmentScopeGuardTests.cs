using System.Linq.Expressions;
using Application.Bases.Exceptions;
using Application.Segments;
using Application.Services;
using Domain.Organizations;
using Domain.Projects;
using Domain.Policies;
using Domain.Resources;
using Domain.Segments;
using Environment = Domain.Environments.Environment;

namespace Application.UnitTests.Handlers;

public class SegmentScopeGuardTests
{
    [Theory]
    [InlineData("organization/o", true)]
    [InlineData("organization/o:project/p", true)]
    [InlineData("organization/o:project/p:env/e", true)]
    [InlineData("project/p:env/e", false)]
    [InlineData("organization/o:env/e", false)]
    [InlineData("organization/o:project/p:env/e:segment/s", false)]
    [InlineData("organization/*", false)]
    [InlineData("organization/o;tag", false)]
    [InlineData("organization/o/extra", false)]
    [InlineData("organization/", false)]
    [InlineData(null, false)]
    public void ScopeShapeIsValidated(string? scope, bool valid)
    {
        var request = new CreateSegment { Name = "S", Key = "s", Type = SegmentType.Shared, Scopes = [scope!] };
        Assert.Equal(valid, new CreateSegmentValidator().Validate(request).IsValid);
    }

    [Theory]
    [InlineData("organization/o")]
    [InlineData("organization/o:project/p")]
    [InlineData("organization/o:project/p:env/e")]
    public async Task CrossOrganizationSharingUsesTargetOrganizationPermissions(string scope)
    {
        var f = new Fixture();
        await f.Guard.EnsureAllowedAsync(f.Request(scope));
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
        await Assert.ThrowsAsync<ForbiddenException>(() => f.Guard.EnsureAllowedAsync(f.Request("organization/o:project/p:env/e")));
    }

    [Theory]
    [InlineData("deny")]
    [InlineData("wildcard-deny")]
    public async Task BroadScopeCannotBypassNarrowEnvironmentDeny(string failure)
    {
        var f = new Fixture(failure);
        await Assert.ThrowsAsync<ForbiddenException>(() => f.Guard.EnsureAllowedAsync(f.Request("organization/o")));
    }

    [Fact]
    public async Task EveryScopeMustBeAuthorized()
    {
        var f = new Fixture();
        var request = f.Request("organization/o:project/p:env/e");
        request.Scopes = [request.Scopes[0], "organization/missing"];
        await Assert.ThrowsAsync<ForbiddenException>(() => f.Guard.EnsureAllowedAsync(request));
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
        if (matching) await f.Guard.EnsureAllowedAsync(request);
        else await Assert.ThrowsAsync<ForbiddenException>(() => f.Guard.EnsureAllowedAsync(request));
    }

    private sealed class Fixture
    {
        public Guid Workspace { get; } = Guid.NewGuid();
        public Guid RequestOrg { get; } = Guid.NewGuid();
        public Organization Org { get; }
        public Environment Env { get; }
        public SegmentScopeGuard Guard { get; }
        public Mock<IOrganizationPermissions> Permissions { get; } = new();
        public Fixture(string failure = "")
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
            Permissions.Setup(x => x.GetAsync(Org.Id)).ReturnsAsync(policies.ToArray());
            Guard = new(orgs.Object, projects.Object, envs.Object, Permissions.Object);
        }
        public CreateSegment Request(string scope) => new()
        { WorkspaceId = Workspace, OrgId = RequestOrg, EnvId = Guid.NewGuid(), Key = "s", Type = SegmentType.Shared, Scopes = [scope] };
    }
}

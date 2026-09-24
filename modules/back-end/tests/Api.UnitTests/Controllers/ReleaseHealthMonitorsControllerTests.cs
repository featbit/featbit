using System.Linq.Expressions;
using Api.Authorization;
using Api.Controllers;
using Application.Bases.Exceptions;
using Application.ReleaseHealth;
using Application.Services;
using Application.Users;
using Domain.AuditLogs;
using Domain.FeatureFlags;
using Domain.Policies;
using Domain.Projects;
using Domain.Resources;
using Infrastructure.ReleaseHealth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Environment = Domain.Environments.Environment;

namespace Api.UnitTests.Controllers;

public class ReleaseHealthMonitorsControllerTests
{
    [Fact]
    public void AllEndpointsRequireProjectAndEnvironmentAccess()
    {
        var policies = typeof(ReleaseHealthMonitorsController).GetCustomAttributes(typeof(AuthorizeAttribute), true)
            .Cast<AuthorizeAttribute>().Select(x => x.Policy);
        Assert.Contains(Permissions.CanAccessProject, policies);
        Assert.Contains(Permissions.CanAccessEnv, policies);
    }

    [Theory]
    [InlineData("status")]
    [InlineData("add")]
    [InlineData("update")]
    [InlineData("binding_status")]
    [InlineData("remove")]
    public async Task EveryWriteHonorsExactFlagDenyEvenWithEnvironmentWildcardAllow(string action)
    {
        var f = new Fixture();
        f.Permissions = [Allow("project/p:env/prod:flag/*"), Allow(f.Rn, EffectType.Deny)];
        await Assert.ThrowsAsync<ForbiddenException>(async () =>
        {
            switch (action)
            {
                case "status": await f.Controller.Status(f.Project.Id, f.Env.Id, f.Flag.Id, new(0, false), default); break;
                case "add": await f.Controller.AddBinding(f.Project.Id, f.Env.Id, f.Flag.Id, new(0, Guid.NewGuid(), Guid.NewGuid(), "trend"), default); break;
                case "update": await f.Controller.UpdateBinding(f.Project.Id, f.Env.Id, f.Flag.Id, Guid.NewGuid(), new(0, Guid.NewGuid(), Guid.NewGuid(), "trend"), default); break;
                case "binding_status": await f.Controller.BindingStatus(f.Project.Id, f.Env.Id, f.Flag.Id, Guid.NewGuid(), new(0, false), default); break;
                case "remove": await f.Controller.RemoveBinding(f.Project.Id, f.Env.Id, f.Flag.Id, Guid.NewGuid(), 0, default); break;
            }
        });
        f.Resources.Verify(x => x.GetFlagRnAsync(f.Env.Id, f.Flag.Key), Times.Once);
        f.Store.Verify(x => x.PutAsync(It.IsAny<ReleaseHealthDocument>(), It.IsAny<long?>(), It.IsAny<CancellationToken>()), Times.Never);
        f.Audits.Verify(x => x.AddOneAsync(It.IsAny<AuditLog>()), Times.Never);
    }

    [Fact]
    public async Task ExactFlagPermissionSavesAndAddsExistingFeatureFlagAuditReference()
    {
        var f = new Fixture();
        f.Permissions = [Allow(f.Rn)];
        await f.Controller.Status(f.Project.Id, f.Env.Id, f.Flag.Id, new(0, false), default);
        f.Store.Verify(x => x.PutAsync(It.Is<ReleaseHealthDocument>(d => d.ScopeId == f.Env.Id && d.Id == f.Flag.Id && d.Version == 1),
            null, It.IsAny<CancellationToken>()), Times.Once);
        f.Audits.Verify(x => x.AddOneAsync(It.Is<AuditLog>(a => a.EnvId == f.Env.Id &&
            a.RefType == AuditLogRefTypes.FeatureFlag && a.RefId == f.Flag.Id.ToString() && a.CreatorId == f.Actor &&
            a.Comment.Contains("Release Health") && a.DataChange.Current.Contains("releaseHealthMonitor") &&
            a.DataChange.Current.Contains("\"enabled\":false"))), Times.Once);
    }

    [Fact]
    public async Task ReadDoesNotRequireFlagWritePermissionAndWrongEnvironmentFlagFailsClosed()
    {
        var f = new Fixture();
        await f.Controller.Get(f.Project.Id, f.Env.Id, f.Flag.Id, default);
        f.Resources.Verify(x => x.GetFlagRnAsync(It.IsAny<Guid>(), It.IsAny<string>()), Times.Never);
        f.Flag.EnvId = Guid.NewGuid();
        await Assert.ThrowsAsync<EntityNotFoundException>(() => f.Controller.Get(f.Project.Id, f.Env.Id, f.Flag.Id, default));
        await Assert.ThrowsAsync<EntityNotFoundException>(() => f.Controller.Status(f.Project.Id, f.Env.Id, f.Flag.Id, new(0, false), default));
    }

    private static PolicyStatement Allow(string resource, string effect = EffectType.Allow) => new()
    {
        Id = Guid.NewGuid().ToString(), ResourceType = ResourceTypes.FeatureFlag, Effect = effect,
        Actions = [Permissions.UpdateFlagTargetingRules], Resources = [resource]
    };

    private sealed class Fixture
    {
        public Guid OrgId { get; } = Guid.NewGuid();
        public Guid Actor { get; } = Guid.NewGuid();
        public Project Project { get; }
        public Environment Env { get; }
        public FeatureFlag Flag { get; }
        public string Rn => "project/p:env/prod:flag/checkout";
        public PolicyStatement[] Permissions { get; set; } = [];
        public Mock<IReleaseHealthStore> Store { get; } = new();
        public Mock<IResourceService> Resources { get; } = new();
        public Mock<IAuditLogService> Audits { get; } = new();
        public ReleaseHealthMonitorsController Controller { get; }
        public Fixture()
        {
            Project = new(OrgId, "Project", "p") { Id = Guid.NewGuid() };
            Env = new(Project.Id, "Production", "prod");
            Flag = new() { Id = Guid.NewGuid(), EnvId = Env.Id, Name = "Checkout", Key = "checkout" };
            var projects = new Mock<IProjectService>();
            projects.Setup(x => x.FindOneAsync(It.IsAny<Expression<Func<Project, bool>>>()))
                .Returns((Expression<Func<Project, bool>> p) => Task.FromResult(p.Compile()(Project) ? Project : null));
            var envs = new Mock<IEnvironmentService>();
            envs.Setup(x => x.AnyAsync(It.IsAny<Expression<Func<Environment, bool>>>()))
                .Returns((Expression<Func<Environment, bool>> p) => Task.FromResult(p.Compile()(Env)));
            var flags = new Mock<IFeatureFlagService>();
            flags.Setup(x => x.FindOneAsync(It.IsAny<Expression<Func<FeatureFlag, bool>>>()))
                .Returns((Expression<Func<FeatureFlag, bool>> p) => Task.FromResult(p.Compile()(Flag) ? Flag : null));
            Resources.Setup(x => x.GetFlagRnAsync(Env.Id, Flag.Key)).ReturnsAsync(Rn);
            var permissions = new Mock<IRequestPermissions>();
            permissions.Setup(x => x.GetAsync(It.IsAny<HttpContext>())).ReturnsAsync(() => Permissions);
            var user = new Mock<ICurrentUser>();
            user.SetupGet(x => x.Id).Returns(Actor);
            var services = new ServiceCollection().AddSingleton(permissions.Object).AddSingleton(user.Object).BuildServiceProvider();
            var context = new DefaultHttpContext { RequestServices = services };
            context.Request.Headers[ApiConstants.OrgIdHeaderKey] = OrgId.ToString();
            var service = new ReleaseHealthService(Store.Object, Mock.Of<ICredentialProtector>(), [], envs.Object,
                projects.Object, NullLogger<ReleaseHealthService>.Instance);
            Controller = new(service, flags.Object, Resources.Object, Audits.Object)
            {
                ControllerContext = new ControllerContext { HttpContext = context }
            };
        }
    }
}

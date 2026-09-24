using System.Linq.Expressions;
using System.Text.Json;
using Api.Authorization;
using Api.Controllers;
using Application.Bases.Exceptions;
using Application.ReleaseHealth;
using Application.Services;
using Application.Users;
using Domain.Policies;
using Domain.Projects;
using Domain.Resources;
using Infrastructure.ReleaseHealth;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Env = Domain.Environments.Environment;

namespace Api.UnitTests.Controllers;

public class ReleaseHealthWebhookControllerTests
{
    [Fact]
    public async Task DeletedScopeDoesNotBreakListAndRemainingScopeStillControlsManagement()
    {
        var f = new Fixture();
        var id = f.Seed([$"{f.Project.Id}/{f.Env.Id}", $"{f.Project.Id}/{Guid.NewGuid()}"]);
        var item = Assert.Single((await f.Controller.List(default)).Data);
        Assert.True(item.CanManage);
        f.Statements = [Permission(ResourceTypes.Env, Permissions.CanAccessEnv, "project/p:env/prod")];
        Assert.False(Assert.Single((await f.Controller.List(default)).Data).CanManage);
        await Assert.ThrowsAsync<ForbiddenException>(() => f.Controller.Delete(id, 1, default));
        Assert.Single(f.Documents);
    }

    [Fact]
    public async Task EntirelyOrphanedWebhookCanOnlyBeRecoveredByAnOrganizationManager()
    {
        var f = new Fixture();
        var id = f.Seed([$"{f.Project.Id}/{Guid.NewGuid()}"]);
        Assert.Empty((await f.Controller.List(default)).Data);
        await Assert.ThrowsAsync<ForbiddenException>(() => f.Controller.Delete(id, 1, default));
        f.Statements = [Permission(ResourceTypes.Organization, Permissions.UpdateOrgName, RN.ForOrganization())];
        Assert.True(Assert.Single((await f.Controller.List(default)).Data).CanManage);
        Assert.True((await f.Controller.Delete(id, 1, default)).Data);
    }

    [Fact]
    public async Task MissingNewScopesAreRejectedAndLiveExplicitDenyIsNeverIgnored()
    {
        var f = new Fixture();
        var write = new MonitorWebhookWrite("Operations", "https://example.com/hook", true, [$"{f.Project.Id}/{Guid.NewGuid()}"],
            "custom", "{}", new("remove"), new("remove"), null);
        await Assert.ThrowsAsync<EntityNotFoundException>(() => f.Controller.Create(write, default));
        var id = f.Seed([$"{f.Project.Id}/{f.Env.Id}", $"{f.Project.Id}/{Guid.NewGuid()}"]);
        f.Statements = [Permission(ResourceTypes.Env, "*", "project/p:env/*"), Permission(ResourceTypes.Env, Permissions.UpdateEnvSettings, "project/p:env/prod", EffectType.Deny)];
        await Assert.ThrowsAsync<ForbiddenException>(() => f.Controller.Delete(id, 1, default));
    }

    [Fact]
    public async Task ExistingForeignOrganizationScopeIsNotTreatedAsDeleted()
    {
        var f = new Fixture();
        f.Seed([$"{f.Project.Id}/{f.Env.Id}"]);
        f.Project.OrganizationId = Guid.NewGuid();
        await Assert.ThrowsAsync<ForbiddenException>(() => f.Controller.List(default));
    }

    private static PolicyStatement Permission(string resourceType, string action, string resource, string effect = EffectType.Allow) => new()
    {
        Id = Guid.NewGuid().ToString(), ResourceType = resourceType, Actions = [action], Resources = [resource], Effect = effect
    };

    private sealed class Fixture
    {
        public Guid Org { get; } = Guid.NewGuid();
        public Project Project { get; }
        public Env Env { get; }
        public Dictionary<Guid, ReleaseHealthDocument> Documents { get; } = [];
        public PolicyStatement[] Statements { get; set; } = [Permission(ResourceTypes.Env, "*", "project/p:env/prod")];
        public ReleaseHealthWebhookController Controller { get; }
        public Fixture()
        {
            Project = new(Org, "Project", "p") { Id = Guid.NewGuid() };
            Env = new(Project.Id, "Production", "prod");
            var projects = new Mock<IProjectService>();
            projects.Setup(x => x.FindOneAsync(It.IsAny<Expression<Func<Project, bool>>>()))
                .ReturnsAsync((Expression<Func<Project, bool>> predicate) => predicate.Compile()(Project) ? Project : null);
            var envs = new Mock<IEnvironmentService>();
            envs.Setup(x => x.FindOneAsync(It.IsAny<Expression<Func<Env, bool>>>()))
                .ReturnsAsync((Expression<Func<Env, bool>> predicate) => predicate.Compile()(Env) ? Env : null);
            envs.Setup(x => x.AnyAsync(It.IsAny<Expression<Func<Env, bool>>>()))
                .ReturnsAsync((Expression<Func<Env, bool>> predicate) => predicate.Compile()(Env));
            var store = new Mock<IReleaseHealthStore>();
            store.Setup(x => x.ListAsync(Org, ReleaseHealthService.MonitorWebhookKind, It.IsAny<CancellationToken>()))
                .ReturnsAsync(() => Documents.Values.ToArray());
            store.Setup(x => x.FindAsync(Org, ReleaseHealthService.MonitorWebhookKind, It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync((Guid _, string _, Guid id, CancellationToken _) => Documents.GetValueOrDefault(id));
            store.Setup(x => x.PutAsync(It.IsAny<ReleaseHealthDocument>(), It.IsAny<long?>(), It.IsAny<CancellationToken>()))
                .Callback((ReleaseHealthDocument document, long? _, CancellationToken _) => Documents[document.Id] = document).Returns(Task.CompletedTask);
            var resources = new Mock<IResourceService>();
            resources.Setup(x => x.GetEnvRnAsync(Env.Id)).ReturnsAsync("project/p:env/prod");
            var permissions = new Mock<IRequestPermissions>();
            permissions.Setup(x => x.GetAsync(It.IsAny<HttpContext>())).ReturnsAsync(() => Statements);
            var user = new Mock<ICurrentUser>();
            user.SetupGet(x => x.Id).Returns(Guid.NewGuid());
            var context = new DefaultHttpContext { RequestServices = new ServiceCollection().AddSingleton(permissions.Object).AddSingleton(user.Object).BuildServiceProvider() };
            context.Request.Headers[ApiConstants.OrgIdHeaderKey] = Org.ToString();
            var service = new ReleaseHealthService(store.Object, Mock.Of<ICredentialProtector>(), [], envs.Object, projects.Object, NullLogger<ReleaseHealthService>.Instance);
            Controller = new(service, resources.Object) { ControllerContext = new ControllerContext { HttpContext = context } };
        }
        public Guid Seed(string[] scopes)
        {
            var id = Guid.NewGuid();
            var payload = JsonSerializer.Serialize(new { purpose = "release-health", name = "Operations", url = "https://example.com", isActive = true,
                scopes, scopeNames = scopes, payloadTemplateType = "custom", payloadTemplate = "{}", hasHeaders = false, hasSecret = false,
                createdAt = DateTimeOffset.UtcNow, updatedAt = DateTimeOffset.UtcNow, updatedBy = Guid.NewGuid(), isDeleted = false });
            Documents[id] = new(id, Org, Org, ReleaseHealthService.MonitorWebhookKind, id.ToString(), 1, payload, null);
            return id;
        }
    }
}

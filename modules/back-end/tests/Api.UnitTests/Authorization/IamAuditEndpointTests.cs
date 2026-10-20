using Api.Authorization;
using Application.Services;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.TestHost;
using Microsoft.AspNetCore.Authorization.Policy;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using System.Net;
using System.Security.Claims;
using Api.Controllers;
using Domain.Policies;
using Domain.Resources;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Reflection;
using Api;
using Api.Authentication;
using Application.AuditLogs;
using Application.Bases.Models;
using Domain.AuditLogs;
using MediatR;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.Infrastructure;

namespace Api.UnitTests.Authorization;

public class IamAuditEndpointTests
{
    [Theory]
    [InlineData(false, "/api/v1/iam/audit-logs")]
    [InlineData(false, "/api/v1/iam/audit-logs/actors")]
    [InlineData(true, "/api/v1/iam/audit-logs")]
    [InlineData(true, "/api/v1/iam/audit-logs/actors")]
    [InlineData(false, "/api/v1/envs/11111111-1111-1111-1111-111111111111/audit-logs")]
    [InlineData(true, "/api/v1/envs/11111111-1111-1111-1111-111111111111/audit-logs")]
    public async Task IamAuthorizationMiddleware_ProtectsBothRoutes(bool allowed, string path)
    {
        var actionName = path.Contains("/envs/") ? nameof(AuditLogController.GetListAsync)
            : path.EndsWith("/actors") ? nameof(AuditLogController.IamActors)
            : nameof(AuditLogController.GetIamListAsync);
        var action = GetActions().Single(x => x.MethodInfo.Name == actionName);
        var permissions = new Mock<IRequestPermissions>();
        permissions.Setup(x => x.GetAsync(It.IsAny<HttpContext>())).ReturnsAsync(allowed
            ? new[] { new PolicyStatement { ResourceType = "iam", Effect = EffectType.Allow,
                Actions = [Permissions.CanManageIAM], Resources = ["iam/*"] } }
            : Array.Empty<PolicyStatement>());
        using var host = await new HostBuilder().ConfigureWebHost(web =>
        {
            web.UseTestServer();
            web.ConfigureServices(services =>
            {
                services.AddRouting();
                services.AddLogging();
                services.AddAuthentication();
                services.AddSingleton(permissions.Object);
                services.AddSingleton(Mock.Of<IResourceService>());
                services.AddSingleton<IPermissionChecker, DefaultPermissionChecker>();
                services.AddSingleton<IAuthorizationHandler, PermissionRequirementHandler>();
                services.AddSingleton<IAuthorizationMiddlewareResultHandler, ApiAuthorizationResultHandler>();
                services.AddAuthorization(options => options.AddPolicy(Permissions.CanManageIAM,
                    policy => policy.AddRequirements(new PermissionRequirement(Permissions.CanManageIAM))));
            });
            web.Configure(app =>
            {
                app.UseRouting();
                app.Use((context, next) =>
                {
                    context.User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, "user")], "test"));
                    return next(context);
                });
                app.UseAuthorization();
                app.UseEndpoints(endpoints => endpoints.MapGet(path, () => "allowed")
                    .RequireAuthorization(action.EndpointMetadata.OfType<IAuthorizeData>().ToArray()));
            });
        }).StartAsync();
        var response = await host.GetTestClient().GetAsync(path);
        Assert.Equal(allowed || path.Contains("/envs/") ? HttpStatusCode.OK : HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public void BothIamEndpoints_RequireManageIam_AndNoGlobalAuditRouteRemains()
    {
        var actions = GetActions();
        Assert.Equal(3, actions.Length);
        foreach (var action in actions)
        {
            var isEnvironment = action.MethodInfo.Name == nameof(AuditLogController.GetListAsync);
            var expectedRoute = isEnvironment
                ? "api/v{version:apiVersion}/envs/{envId:guid}/audit-logs"
                : "api/v{version:apiVersion}/iam/audit-logs" +
                    (action.MethodInfo.Name == nameof(AuditLogController.IamActors) ? "/actors" : "");
            Assert.Equal(expectedRoute, action.AttributeRouteInfo!.Template);
            Assert.Empty(action.EndpointMetadata.OfType<IAllowAnonymous>());
            var authorization = action.EndpointMetadata.OfType<IAuthorizeData>().ToArray();
            Assert.NotEmpty(authorization);
            Assert.Equal(!isEnvironment, authorization.Any(x => x.Policy == Permissions.CanManageIAM));
            Assert.Equal(isEnvironment, action.MethodInfo.IsDefined(typeof(OpenApiAttribute), true));
        }
        Assert.False(typeof(AuditLogController).IsDefined(typeof(OpenApiAttribute), true));
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task ListActions_PreserveQueryScope(bool iam)
    {
        var workspaceId = Guid.NewGuid();
        var orgId = Guid.NewGuid();
        var envId = Guid.NewGuid();
        var filter = new AuditLogFilter { EnvId = Guid.NewGuid(), CrossEnvironment = true };
        var sender = new Mock<ISender>(MockBehavior.Strict);
        sender.Setup(x => x.Send(It.Is<GetAuditLogList>(q =>
                q.WorkspaceId == workspaceId && q.OrgId == orgId && q.IsIam == iam &&
                q.Filter == filter && (iam || q.Filter.EnvId == envId)), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PagedResult<AuditLogVm>(0, []));
        using var services = new ServiceCollection().AddSingleton(sender.Object).BuildServiceProvider();
        var controller = CreateController(services, workspaceId, orgId);

        if (iam)
            await controller.GetIamListAsync(filter);
        else
            await controller.GetListAsync(envId, filter);

        sender.VerifyAll();
        sender.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task IamActors_PreservesWorkspaceOrganizationAndFilter()
    {
        var workspaceId = Guid.NewGuid();
        var orgId = Guid.NewGuid();
        var filter = new AuditLogFilter();
        var sender = new Mock<ISender>(MockBehavior.Strict);
        sender.Setup(x => x.Send(It.Is<GetAuditLogActors>(q =>
                q.WorkspaceId == workspaceId && q.OrgId == orgId && q.Filter == filter),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(Array.Empty<AuditActor>());
        using var services = new ServiceCollection().AddSingleton(sender.Object).BuildServiceProvider();

        await CreateController(services, workspaceId, orgId).IamActors(filter);

        sender.VerifyAll();
        sender.VerifyNoOtherCalls();
    }

    private static AuditLogController CreateController(IServiceProvider services, Guid workspaceId, Guid orgId)
    {
        var context = new DefaultHttpContext { RequestServices = services };
        context.Request.Headers[ApiConstants.WorkspaceHeaderKey] = workspaceId.ToString();
        context.Request.Headers[ApiConstants.OrgIdHeaderKey] = orgId.ToString();
        return new AuditLogController { ControllerContext = new ControllerContext { HttpContext = context } };
    }

    private static ControllerActionDescriptor[] GetActions()
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddControllers().AddApplicationPart(typeof(AuditLogController).Assembly);
        using var provider = services.BuildServiceProvider();
        return provider.GetRequiredService<IActionDescriptorCollectionProvider>().ActionDescriptors.Items
            .OfType<ControllerActionDescriptor>()
            .Where(x => x.ControllerTypeInfo.AsType() == typeof(AuditLogController)).ToArray();
    }
}

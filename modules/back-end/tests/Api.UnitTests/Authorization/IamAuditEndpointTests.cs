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

namespace Api.UnitTests.Authorization;

public class IamAuditEndpointTests
{
    [Theory]
    [InlineData(false, "/api/v1/iam/audit-logs")]
    [InlineData(false, "/api/v1/iam/audit-logs/actors")]
    [InlineData(true, "/api/v1/iam/audit-logs")]
    [InlineData(true, "/api/v1/iam/audit-logs/actors")]
    public async Task IamAuthorizationMiddleware_ProtectsBothRoutes(bool allowed, string path)
    {
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
                    .RequireAuthorization(typeof(IamAuditLogController).GetCustomAttributes<AuthorizeAttribute>().ToArray()));
            });
        }).StartAsync();
        var response = await host.GetTestClient().GetAsync(path);
        Assert.Equal(allowed ? HttpStatusCode.OK : HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public void BothIamEndpoints_RequireManageIam_AndNoGlobalAuditRouteRemains()
    {
        var controller = typeof(IamAuditLogController);
        Assert.Contains(controller.GetCustomAttributes<AuthorizeAttribute>(), x => x.Policy == Permissions.CanManageIAM);
        Assert.Equal("api/v{version:apiVersion}/iam/audit-logs", controller.GetCustomAttribute<RouteAttribute>(inherit: false)!.Template);
        foreach (var name in new[] { "GetListAsync", "Actors" })
            Assert.Empty(controller.GetMethod(name)!.GetCustomAttributes<AllowAnonymousAttribute>());
        Assert.Equal("api/v{version:apiVersion}/envs/{envId:guid}/audit-logs",
            typeof(AuditLogController).GetCustomAttribute<RouteAttribute>(inherit: false)!.Template);
        Assert.Single(typeof(AuditLogController).GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly));
    }
}

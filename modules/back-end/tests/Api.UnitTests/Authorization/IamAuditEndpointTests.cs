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
    [InlineData(false, "/api/v1/audit-logs")]
    [InlineData(false, "/api/v1/audit-logs/actors")]
    [InlineData(true, "/api/v1/audit-logs")]
    [InlineData(true, "/api/v1/audit-logs/actors")]
    [InlineData(false, "/api/v1/envs/11111111-1111-1111-1111-111111111111/audit-logs")]
    [InlineData(true, "/api/v1/envs/11111111-1111-1111-1111-111111111111/audit-logs")]
    [InlineData(false, "/api/v1/envs/11111111-1111-1111-1111-111111111111/audit-logs", "", 200)]
    [InlineData(true, "/api/v1/audit-logs", "", 200)]
    [InlineData(true, "/api/v1/audit-logs/actors", "", 200)]
    [InlineData(true, "/api/v1/audit-logs", "unknown", 400)]
    [InlineData(true, "/api/v1/audit-logs/actors", "999", 400)]
    [InlineData(true, "/api/v1/audit-logs", "unspecified", 200)]
    [InlineData(true, "/api/v1/audit-logs/actors", "unspecified", 200)]
    [InlineData(false, "/api/v1/audit-logs", "environment", 200)]
    [InlineData(false, "/api/v1/audit-logs/actors", "environment", 200)]
    [InlineData(true, "/api/v1/audit-logs", "iam", 401, false)]
    [InlineData(true, "/api/v1/audit-logs/actors", "iam", 401, false)]
    public async Task Routes_ValidateScopeAndIamPermission(
        bool allowed, string path, string scope = "iam", int? expectedStatus = null, bool authenticated = true)
    {
        var sender = new Mock<ISender>();
        var logs = new Mock<IAuditLogService>();
        logs.Setup(x => x.GetListAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<AuditLogFilter>()))
            .ReturnsAsync(new PagedResult<AuditLog>(0, []));
        logs.Setup(x => x.GetActorsAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<AuditLogFilter>()))
            .ReturnsAsync(Array.Empty<AuditActor>());
        var mapper = new Mock<AutoMapper.IMapper>();
        mapper.Setup(x => x.Map<PagedResult<AuditLogVm>>(It.IsAny<object>()))
            .Returns(new PagedResult<AuditLogVm>(0, []));
        var access = new AuditLogAccess();
        var listHandler = new GetAuditLogListHandler(logs.Object, Mock.Of<IUserService>(),
            Mock.Of<IAccessTokenService>(), mapper.Object, access);
        var actorsHandler = new GetAuditLogActorsHandler(logs.Object, access);
        sender.Setup(x => x.Send(It.IsAny<GetAuditLogList>(), It.IsAny<CancellationToken>()))
            .Returns((GetAuditLogList request, CancellationToken ct) => listHandler.Handle(request, ct));
        sender.Setup(x => x.Send(It.IsAny<GetAuditLogActors>(), It.IsAny<CancellationToken>()))
            .Returns((GetAuditLogActors request, CancellationToken ct) => actorsHandler.Handle(request, ct));
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
                services.AddControllers().AddApplicationPart(typeof(AuditLogController).Assembly);
                services.AddApiVersioning().AddMvc();
                services.AddSingleton(sender.Object);
                services.AddLogging();
                services.AddAuthentication();
                services.AddSingleton(permissions.Object);
                services.AddSingleton<IAuthorizationMiddlewareResultHandler, ApiAuthorizationResultHandler>();
                services.AddAuthorization();
            });
            web.Configure(app =>
            {
                app.UseRouting();
                app.Use((context, next) =>
                {
                    context.User = new ClaimsPrincipal(new ClaimsIdentity(
                        [new Claim(ClaimTypes.NameIdentifier, "user")], authenticated ? "test" : null));
                    return next(context);
                });
                app.UseAuthorization();
                app.Use(async (context, next) =>
                {
                    try { await next(context); }
                    catch (Application.Bases.Exceptions.ForbiddenException)
                    {
                        context.Response.StatusCode = StatusCodes.Status403Forbidden;
                    }
                });
                app.UseEndpoints(endpoints => endpoints.MapControllers());
            });
        }).StartAsync();
        var response = await host.GetTestClient().GetAsync(path + "?envId=22222222-2222-2222-2222-222222222222" + (scope == "" ? "" : "&scope=" + scope));
        Assert.Equal(expectedStatus.HasValue ? (HttpStatusCode)expectedStatus.Value :
            allowed || path.Contains("/envs/") ? HttpStatusCode.OK : HttpStatusCode.Forbidden, response.StatusCode);
        if (response.StatusCode != HttpStatusCode.OK)
            logs.VerifyNoOtherCalls();
        else
        {
            var isEnvironmentRoute = path.Contains("/envs/");
            var expectedScope = isEnvironmentRoute ? AuditLogScope.Environment :
                scope == "" ? AuditLogScope.Unspecified : Enum.Parse<AuditLogScope>(scope, ignoreCase: true);
            if (path.EndsWith("/actors"))
                sender.Verify(x => x.Send(It.Is<GetAuditLogActors>(q => q.Filter.Scope == expectedScope),
                    It.IsAny<CancellationToken>()), Times.Once);
            else
                sender.Verify(x => x.Send(It.Is<GetAuditLogList>(q => q.Filter.Scope == expectedScope &&
                    (!isEnvironmentRoute || q.Filter.EnvId == Guid.Parse("11111111-1111-1111-1111-111111111111"))),
                    It.IsAny<CancellationToken>()), Times.Once);
        }
    }

    [Fact]
    public void AuditEndpoints_PreserveRoutesAuthenticationAndOpenApiBoundary()
    {
        var actions = GetActions();
        Assert.Equal(3, actions.Length);
        foreach (var action in actions)
        {
            var isEnvironment = action.MethodInfo.Name == nameof(AuditLogController.GetListAsync);
            var expectedRoute = isEnvironment
                ? "api/v{version:apiVersion}/envs/{envId:guid}/audit-logs"
                : "api/v{version:apiVersion}/audit-logs" +
                    (action.MethodInfo.Name == nameof(AuditLogController.Actors) ? "/actors" : "");
            Assert.Equal(expectedRoute, action.AttributeRouteInfo!.Template);
            Assert.Empty(action.EndpointMetadata.OfType<IAllowAnonymous>());
            var authorization = action.EndpointMetadata.OfType<IAuthorizeData>().ToArray();
            Assert.NotEmpty(authorization);
            Assert.DoesNotContain(authorization, x => x.Policy == Permissions.CanManageIAM);
            Assert.Equal(isEnvironment, action.MethodInfo.IsDefined(typeof(OpenApiAttribute), true));
        }
        Assert.False(typeof(AuditLogController).IsDefined(typeof(OpenApiAttribute), true));
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    [InlineData(false, true)]
    public async Task ListActions_PreserveQueryScope(bool iam, bool genericEnvironment = false)
    {
        var workspaceId = Guid.NewGuid();
        var orgId = Guid.NewGuid();
        var envId = Guid.NewGuid();
        var filter = new AuditLogFilter { Scope = AuditLogScope.Iam, EnvId = Guid.NewGuid(), CrossEnvironment = true };
        var sender = new Mock<ISender>(MockBehavior.Strict);
        sender.Setup(x => x.Send(It.Is<GetAuditLogList>(q =>
                q.WorkspaceId == workspaceId && q.OrgId == orgId && q.Filter.Scope == (iam ? AuditLogScope.Iam : AuditLogScope.Environment) &&
                q.Permissions == TestPermissions && q.Filter == filter && (iam || q.Filter.EnvId == envId)), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PagedResult<AuditLogVm>(0, []));
        using var services = new ServiceCollection().AddSingleton(sender.Object)
            .AddSingleton(Mock.Of<IRequestPermissions>(x => x.GetAsync(It.IsAny<HttpContext>()) == Task.FromResult(TestPermissions)))
            .BuildServiceProvider();
        var controller = CreateController(services, workspaceId, orgId);

        if (iam)
            await controller.QueryAsync(filter);
        else if (genericEnvironment)
        {
            filter.EnvId = envId;
            filter.Scope = AuditLogScope.Environment;
            await controller.QueryAsync(filter);
        }
        else
            await controller.GetListAsync(envId, filter);

        sender.VerifyAll();
        sender.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Actors_PreservesWorkspaceOrganizationAndFilter()
    {
        var workspaceId = Guid.NewGuid();
        var orgId = Guid.NewGuid();
        var filter = new AuditLogFilter { Scope = AuditLogScope.Iam };
        var sender = new Mock<ISender>(MockBehavior.Strict);
        sender.Setup(x => x.Send(It.Is<GetAuditLogActors>(q =>
                q.WorkspaceId == workspaceId && q.OrgId == orgId && q.Filter.Scope == AuditLogScope.Iam && q.Permissions == TestPermissions && q.Filter == filter),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(Array.Empty<AuditActor>());
        using var services = new ServiceCollection().AddSingleton(sender.Object)
            .AddSingleton(Mock.Of<IRequestPermissions>(x => x.GetAsync(It.IsAny<HttpContext>()) == Task.FromResult(TestPermissions)))
            .BuildServiceProvider();

        await CreateController(services, workspaceId, orgId).Actors(filter);

        sender.VerifyAll();
        sender.VerifyNoOtherCalls();
    }

    private static readonly PolicyStatement[] TestPermissions =
        [new PolicyStatement { ResourceType = "iam", Effect = EffectType.Allow,
            Actions = [Permissions.CanManageIAM], Resources = ["iam/*"] }];

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

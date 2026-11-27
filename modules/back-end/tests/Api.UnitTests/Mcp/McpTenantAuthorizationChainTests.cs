using Api.Authentication;
using Api.Authorization;
using Api.Mcp;
using Api.Middlewares;
using Api;
using Application.FeatureFlags;
using Application.Services;
using Domain.Organizations;
using Domain.Policies;
using Domain.Resources;
using Domain.Users;
using Domain.Workspaces;
using MediatR;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using System.Linq.Expressions;
using System.Security.Claims;

namespace Api.UnitTests.Mcp;

public class McpTenantAuthorizationChainTests
{
    // Exercise the real MCP tool, permission checker and request-permission reader.
    // Database results are modeled explicitly; these are not database cleanup tests.
    [Theory]
    [InlineData("own-header-foreign-resource", false)]
    [InlineData("foreign-header-no-permissions", false)]
    [InlineData("removed-member-cleaned-permissions", false)]
    [InlineData("removed-member-stale-permissions", false)]
    [InlineData("mcp-claim-overridden-with-authorized-org", false)]
    [InlineData("current-member", true)]
    [InlineData("mcp-current-member", true)]
    [InlineData("mcp-removed-member-stale-permissions", false)]
    public async Task Toggle_RequiresCurrentMembershipAndRespectsTokenOrg(
        string scenario, bool allowed)
    {
        var ownOrg = Guid.NewGuid();
        var targetOrg = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var workspaceId = Guid.NewGuid();
        var envId = Guid.NewGuid();
        var experimentId = Guid.NewGuid();
        var context = new DefaultHttpContext();
        context.Request.Path = "/mcp";
        context.SetEndpoint(new Endpoint(null, new EndpointMetadataCollection(), "mcp"));
        context.Request.Headers[ApiConstants.WorkspaceHeaderKey] = workspaceId.ToString();
        context.Request.Headers[ApiConstants.OrgIdHeaderKey] =
            (scenario == "own-header-foreign-resource" ? ownOrg : targetOrg).ToString();
        var claims = new List<Claim> { new(UserClaims.Id, userId.ToString()) };
        if (scenario.StartsWith("mcp-"))
        {
            claims.Add(new Claim(McpClaimTypes.TokenType, McpClaimTypes.McpTokenType));
            claims.Add(new Claim(McpClaimTypes.OrgId,
                (scenario.Contains("overridden") ? ownOrg : targetOrg).ToString()));
            claims.Add(new Claim(McpClaimTypes.WorkspaceId, workspaceId.ToString()));
            if (!scenario.Contains("overridden")) context.Request.Headers.Clear();
        }
        context.User = new ClaimsPrincipal(new ClaimsIdentity(claims, Schemes.JwtBearer));

        PolicyStatement[] wildcard =
        [new() { ResourceType = ResourceTypes.All, Effect = EffectType.Allow, Actions = ["*"], Resources = ["*"] }];
        var members = new Mock<IMemberService>(MockBehavior.Strict);
        members.Setup(x => x.GetPermissionsAsync(It.IsAny<Guid>(), userId))
            .ReturnsAsync((Guid org, Guid _) => org == ownOrg || scenario.Contains("stale") || scenario.Contains("overridden") || allowed ? wildcard : []);
        var permissions = new RequestPermissions(members.Object, NullLogger<RequestPermissions>.Instance);
        var resolver = new Mock<IPermissionTargetResolver>(MockBehavior.Strict);
        resolver.Setup(x => x.ResolveEnvironmentAsync(envId))
            .ReturnsAsync(new PermissionTarget("project/p:env/e", targetOrg));
        resolver.Setup(x => x.ResolveFlagAsync(envId, "flag"))
            .ReturnsAsync(new PermissionTarget("project/p:env/e:flag/flag", targetOrg));
        var checker = new DefaultPermissionChecker(resolver.Object, permissions,
            NullLogger<DefaultPermissionChecker>.Instance);
        var experiments = new Mock<IExperimentService>(MockBehavior.Strict);
        experiments.Setup(x => x.GetEnvIdAsync(experimentId)).ReturnsAsync(envId);
        var sender = new Mock<ISender>(MockBehavior.Strict);
        sender.Setup(x => x.Send(It.IsAny<ToggleFeatureFlag>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Guid.NewGuid());
        var tool = new FeatureFlagMcpTools(sender.Object, experiments.Object,
            new HttpContextAccessor { HttpContext = context }, checker, Mock.Of<ILicenseService>(), permissions);

        var users = new Mock<IUserService>();
        users.Setup(x => x.GetWorkspacesAsync(userId)).ReturnsAsync([new Workspace { Id = workspaceId }]);
        var organizations = new Mock<IOrganizationService>();
        organizations.Setup(x => x.AnyAsync(It.IsAny<Expression<Func<Organization, bool>>>())).ReturnsAsync(true);
        organizations.Setup(x => x.ContainsUserAsync(It.IsAny<Guid>(), userId))
            .ReturnsAsync(!scenario.Contains("removed-member"));
        var validator = new TenantAccessValidator(users.Object, organizations.Object);
        var middleware = new TenantAccessValidationMiddleware(async _ =>
            await tool.ToggleFeatureFlag(experimentId, "flag",
                new FeatureFlagToggleRequest { ConfirmedByUser = true, IsEnabled = true }));
        if (scenario.Contains("removed-member"))
        {
            await middleware.InvokeAsync(context, validator);
            Assert.Equal(StatusCodes.Status403Forbidden, context.Response.StatusCode);
            members.Verify(x => x.GetPermissionsAsync(It.IsAny<Guid>(), userId), Times.Never);
        }
        else if (allowed)
            await middleware.InvokeAsync(context, validator);
        else
            await Assert.ThrowsAsync<UnauthorizedAccessException>(() => middleware.InvokeAsync(context, validator));

        sender.Verify(x => x.Send(It.IsAny<ToggleFeatureFlag>(), It.IsAny<CancellationToken>()),
            allowed ? Times.Once() : Times.Never());
    }
}

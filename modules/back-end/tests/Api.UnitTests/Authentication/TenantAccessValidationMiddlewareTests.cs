using System.Linq.Expressions;
using System.Reflection;
using System.Security.Claims;
using Api;
using Api.Authentication;
using Api.Authorization;
using Api.Controllers;
using Api.Middlewares;
using Application.Services;
using Domain.Organizations;
using Domain.Users;
using Domain.Workspaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.Extensions.Primitives;

namespace Api.UnitTests.Authentication;

public class TenantAccessValidationMiddlewareTests
{
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Guid _organizationId = Guid.NewGuid();
    private readonly Mock<IUserService> _users = new();
    private readonly Mock<IOrganizationService> _organizations = new();
    private bool _reachedEndpoint;

    public TenantAccessValidationMiddlewareTests()
    {
        _users.Setup(x => x.GetWorkspacesAsync(_userId))
            .ReturnsAsync([new Workspace { Id = _workspaceId }]);
        var organization = new Organization(_workspaceId, "org", "org") { Id = _organizationId };
        _organizations.Setup(x => x.AnyAsync(It.IsAny<Expression<Func<Organization, bool>>>()))
            .ReturnsAsync((Expression<Func<Organization, bool>> predicate) => predicate.Compile()(organization));
        _organizations.Setup(x => x.ContainsUserAsync(_organizationId, _userId)).ReturnsAsync(true);
    }

    private DefaultHttpContext Context()
    {
        var context = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity(
                [new Claim(UserClaims.Id, _userId.ToString())], Schemes.JwtBearer))
        };
        context.SetEndpoint(new Endpoint(null, new EndpointMetadataCollection(), "business"));
        context.Request.Headers[ApiConstants.WorkspaceHeaderKey] = _workspaceId.ToString();
        context.Request.Headers[ApiConstants.OrgIdHeaderKey] = _organizationId.ToString();
        return context;
    }

    private async Task AssertResult(HttpContext context, bool allowed)
    {
        var middleware = new TenantAccessValidationMiddleware(_ =>
        {
            _reachedEndpoint = true;
            return Task.CompletedTask;
        });
        await middleware.InvokeAsync(context, new TenantAccessValidator(_users.Object, _organizations.Object));
        Assert.Equal(allowed, _reachedEndpoint);
        Assert.Equal(allowed ? StatusCodes.Status200OK : StatusCodes.Status403Forbidden, context.Response.StatusCode);
    }

    [Fact]
    public Task MemberOfWorkspaceAndOrganization_Continues() => AssertResult(Context(), true);

    [Fact]
    public async Task UnmatchedEndpoint_SkipsValidationWithoutAnyLookup()
    {
        var context = Context();
        context.SetEndpoint(null);
        context.Request.Headers.Clear();

        await AssertResult(context, true);

        _users.VerifyNoOtherCalls();
        _organizations.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task NotWorkspaceMember_RejectsBeforeOrganizationLookup()
    {
        _users.Setup(x => x.GetWorkspacesAsync(_userId)).ReturnsAsync([]);
        await AssertResult(Context(), false);
        _organizations.Verify(x => x.AnyAsync(It.IsAny<Expression<Func<Organization, bool>>>()), Times.Never);
    }

    [Fact]
    public async Task NotOrganizationMember_Rejects()
    {
        _organizations.Setup(x => x.ContainsUserAsync(_organizationId, _userId)).ReturnsAsync(false);
        await AssertResult(Context(), false);
    }

    [Fact]
    public async Task OrganizationInAnotherWorkspace_RejectsEvenWhenUserBelongsToBoth()
    {
        var otherWorkspaceId = Guid.NewGuid();
        _users.Setup(x => x.GetWorkspacesAsync(_userId))
            .ReturnsAsync([new Workspace { Id = _workspaceId }, new Workspace { Id = otherWorkspaceId }]);
        var context = Context();
        context.Request.Headers[ApiConstants.WorkspaceHeaderKey] = otherWorkspaceId.ToString();
        await AssertResult(context, false);
    }

    [Fact]
    public async Task NonexistentOrganization_Rejects()
    {
        var context = Context();
        context.Request.Headers[ApiConstants.OrgIdHeaderKey] = Guid.NewGuid().ToString();
        await AssertResult(context, false);
    }

    [Theory]
    [InlineData(ApiConstants.WorkspaceHeaderKey, "not-a-guid")]
    [InlineData(ApiConstants.WorkspaceHeaderKey, "00000000-0000-0000-0000-000000000000")]
    [InlineData(ApiConstants.WorkspaceHeaderKey, "")]
    [InlineData(ApiConstants.OrgIdHeaderKey, "")]
    [InlineData(ApiConstants.OrgIdHeaderKey, "not-a-guid")]
    [InlineData(ApiConstants.OrgIdHeaderKey, "00000000-0000-0000-0000-000000000000")]
    public Task InvalidContext_Rejects(string header, string value)
    {
        var context = Context();
        context.Request.Headers[header] = value;
        return AssertResult(context, false);
    }

    [Theory]
    [InlineData(ApiConstants.WorkspaceHeaderKey)]
    [InlineData(ApiConstants.OrgIdHeaderKey)]
    public Task MultipleHeaderValues_Rejects(string header)
    {
        var context = Context();
        context.Request.Headers[header] = new StringValues([Guid.NewGuid().ToString(), Guid.NewGuid().ToString()]);
        return AssertResult(context, false);
    }

    private static void SetAction(HttpContext context, Type controller, string method)
    {
        var methodInfo = controller.GetMethod(method)!;
        var attributes = methodInfo.GetCustomAttributes(true).Append(new ControllerActionDescriptor
        {
            ControllerTypeInfo = controller.GetTypeInfo(),
            MethodInfo = methodInfo
        }).ToArray();
        context.SetEndpoint(new Endpoint(null, new EndpointMetadataCollection(attributes), method));
    }

    [Theory]
    [InlineData(false, false)]
    [InlineData(true, false)]
    [InlineData(false, true)]
    public async Task MissingHeaders_RejectsBeforeAnyLookup(bool workspace, bool organization)
    {
        var context = Context();
        if (!workspace) context.Request.Headers.Remove(ApiConstants.WorkspaceHeaderKey);
        if (!organization) context.Request.Headers.Remove(ApiConstants.OrgIdHeaderKey);
        await AssertResult(context, false);
        _users.VerifyNoOtherCalls();
        _organizations.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task JoinOrganization_SkipsContextValidation()
    {
        var context = Context();
        context.Request.Headers.Clear();
        SetAction(context, typeof(UserController), nameof(UserController.JoinOrganizationAsync));
        await AssertResult(context, true);
        _users.VerifyNoOtherCalls();
        _organizations.VerifyNoOtherCalls();
    }

    [Theory]
    [InlineData(Schemes.OpenApi)]
    [InlineData(null)]
    public async Task UnauthenticatedOrNonJwtRequests_SkipValidation(string? scheme)
    {
        var context = Context();
        context.User = new ClaimsPrincipal(new ClaimsIdentity([], scheme));
        await AssertResult(context, true);
        _users.Verify(x => x.GetWorkspacesAsync(It.IsAny<Guid>()), Times.Never);
    }

    [Fact]
    public async Task AnonymousEndpoint_DoesNotValidateStaleContext()
    {
        var context = Context();
        context.Request.Headers[ApiConstants.WorkspaceHeaderKey] = "invalid";
        context.SetEndpoint(new Endpoint(null, new EndpointMetadataCollection(new AllowAnonymousAttribute()), "login"));
        await AssertResult(context, true);
    }

    [Fact]
    public Task MissingUserId_RejectsScopedRequest()
    {
        var context = Context();
        context.User = new ClaimsPrincipal(new ClaimsIdentity([], Schemes.JwtBearer));
        return AssertResult(context, false);
    }

    [Theory]
    [InlineData(TenantContextRequirement.None, true)]
    [InlineData(TenantContextRequirement.Workspace, false)]
    [InlineData(TenantContextRequirement.WorkspaceAndOrganization, false)]
    public Task DeclaredRequirement_ControlsWhetherContextCanBeOmitted(
        TenantContextRequirement requirement, bool allowed)
    {
        var context = Context();
        context.Request.Headers.Clear();
        context.SetEndpoint(new Endpoint(null,
            new EndpointMetadataCollection(new TenantContextAttribute(requirement)), "context"));
        return AssertResult(context, allowed);
    }

    [Fact]
    public async Task NoneRequirement_BypassesInvalidSuppliedContext()
    {
        var context = Context();
        context.Request.Headers[ApiConstants.WorkspaceHeaderKey] = "invalid";
        context.SetEndpoint(new Endpoint(null,
            new EndpointMetadataCollection(new TenantContextAttribute(TenantContextRequirement.None)), "context"));

        await AssertResult(context, true);
        _users.VerifyNoOtherCalls();
        _organizations.VerifyNoOtherCalls();
    }

}

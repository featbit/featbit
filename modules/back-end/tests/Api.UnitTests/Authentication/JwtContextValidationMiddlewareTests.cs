using System.Linq.Expressions;
using System.Reflection;
using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Text;
using Api;
using Api.Authentication;
using Api.Controllers;
using Api.Middlewares;
using Application.Services;
using Domain.Organizations;
using Domain.Users;
using Domain.Workspaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Primitives;
using Microsoft.IdentityModel.Tokens;

namespace Api.UnitTests.Authentication;

public class JwtContextValidationMiddlewareTests
{
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Guid _organizationId = Guid.NewGuid();
    private readonly Mock<IUserService> _users = new();
    private readonly Mock<IOrganizationService> _organizations = new();
    private bool _reachedEndpoint;

    public JwtContextValidationMiddlewareTests()
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
        context.Request.Headers[ApiConstants.WorkspaceHeaderKey] = _workspaceId.ToString();
        context.Request.Headers[ApiConstants.OrgIdHeaderKey] = _organizationId.ToString();
        return context;
    }

    private async Task AssertResult(HttpContext context, bool allowed)
    {
        var middleware = new JwtContextValidationMiddleware(_ =>
        {
            _reachedEndpoint = true;
            return Task.CompletedTask;
        });
        await middleware.InvokeAsync(context, _users.Object, _organizations.Object);
        Assert.Equal(allowed, _reachedEndpoint);
        Assert.Equal(allowed ? StatusCodes.Status200OK : StatusCodes.Status403Forbidden, context.Response.StatusCode);
    }

    [Fact]
    public Task MemberOfWorkspaceAndOrganization_Continues() => AssertResult(Context(), true);

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

    [Fact]
    public Task OrganizationWithoutWorkspace_Rejects()
    {
        var context = Context();
        context.Request.Headers.Remove(ApiConstants.WorkspaceHeaderKey);
        return AssertResult(context, false);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task WorkspaceSelectionWithoutContext_Rejects(bool emptyHeaders)
    {
        var context = Context();
        SetAction(context, typeof(UserController), nameof(UserController.GetWorkspaces));
        context.Request.Headers.Clear();
        if (emptyHeaders)
        {
            context.Request.Headers[ApiConstants.WorkspaceHeaderKey] = "";
            context.Request.Headers[ApiConstants.OrgIdHeaderKey] = "";
        }
        await AssertResult(context, false);
        _users.Verify(x => x.GetWorkspacesAsync(It.IsAny<Guid>()), Times.Never);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task OrganizationSelection_RequiresOrganizationHeader(bool isMember)
    {
        if (!isMember) _users.Setup(x => x.GetWorkspacesAsync(_userId)).ReturnsAsync([]);
        var context = Context();
        SetAction(context, typeof(OrganizationController), nameof(OrganizationController.GetListAsync));
        context.Request.Headers[ApiConstants.OrgIdHeaderKey] = "";
        await AssertResult(context, false);
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
    public async Task UnmarkedBusinessAction_RejectsMissingContextBeforeAnyLookup(bool workspace, bool organization)
    {
        var context = Context();
        SetAction(context, typeof(FeatureFlagController), nameof(FeatureFlagController.GetAsync));
        if (!workspace) context.Request.Headers.Remove(ApiConstants.WorkspaceHeaderKey);
        if (!organization) context.Request.Headers.Remove(ApiConstants.OrgIdHeaderKey);
        await AssertResult(context, false);
        _users.VerifyNoOtherCalls();
        _organizations.VerifyNoOtherCalls();
    }

    [Fact]
    public Task UnmarkedBusinessAction_RejectsEmptyHeaders()
    {
        var context = Context();
        context.Request.Headers[ApiConstants.WorkspaceHeaderKey] = "";
        context.Request.Headers[ApiConstants.OrgIdHeaderKey] = "";
        return AssertResult(context, false);
    }

    [Fact]
    public Task OrganizationSelection_RequiresTenantContext()
    {
        var context = Context();
        SetAction(context, typeof(OrganizationController), nameof(OrganizationController.GetListAsync));
        context.Request.Headers.Clear();
        return AssertResult(context, false);
    }

    [Fact]
    public async Task JoinOrganization_SkipsContextValidation()
    {
        _organizations.Setup(x => x.ContainsUserAsync(_organizationId, _userId)).ReturnsAsync(false);
        var context = Context();
        SetAction(context, typeof(UserController), nameof(UserController.JoinOrganizationAsync));
        await AssertResult(context, true);
        _users.VerifyNoOtherCalls();
        _organizations.VerifyNoOtherCalls();
    }

    [Theory]
    [InlineData(ApiConstants.WorkspaceHeaderKey)]
    [InlineData(ApiConstants.OrgIdHeaderKey)]
    public Task JoinOrganization_WithoutTenantHeader_Continues(string missingHeader)
    {
        var context = Context();
        context.Request.Headers.Remove(missingHeader);
        SetAction(context, typeof(UserController), nameof(UserController.JoinOrganizationAsync));
        return AssertResult(context, true);
    }

    [Theory]
    [InlineData(Schemes.OpenApi)]
    [InlineData(null)]
    public async Task OtherAuthenticationSchemes_AreUnaffected(string? scheme)
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
    [InlineData(true, true, true, false, HttpStatusCode.OK)]
    [InlineData(false, true, true, false, HttpStatusCode.Forbidden)]
    [InlineData(true, false, true, false, HttpStatusCode.Forbidden)]
    [InlineData(true, true, false, false, HttpStatusCode.Forbidden)]
    [InlineData(true, false, true, true, HttpStatusCode.OK)]
    [InlineData(false, false, true, true, HttpStatusCode.OK)]
    [InlineData(true, false, false, true, HttpStatusCode.OK)]
    public async Task SignedJwt_HttpPipelineEnforcesContextBeforeEndpoint(
        bool workspaceMember, bool organizationMember, bool correctWorkspace, bool joining, HttpStatusCode expected)
    {
        var requestedOrganizationId = correctWorkspace ? _organizationId : Guid.NewGuid();
        if (!workspaceMember) _users.Setup(x => x.GetWorkspacesAsync(_userId)).ReturnsAsync([]);
        _organizations.Setup(x => x.ContainsUserAsync(_organizationId, _userId)).ReturnsAsync(organizationMember);
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes("jwt-context-validation-test-key-at-least-32-bytes"));
        using var host = await new HostBuilder().ConfigureWebHost(web => web.UseTestServer()
            .ConfigureServices(services =>
            {
                services.AddRouting();
                services.AddSingleton(_users.Object);
                services.AddSingleton(_organizations.Object);
                services.AddAuthentication(Schemes.JwtBearer).AddJwtBearer(Schemes.JwtBearer, options =>
                {
                    options.TokenValidationParameters = new TokenValidationParameters
                    {
                        AuthenticationType = Schemes.JwtBearer,
                        ValidIssuer = "test",
                        ValidAudience = "test",
                        IssuerSigningKey = key,
                        ValidateIssuerSigningKey = true,
                        ValidateLifetime = true
                    };
                });
                services.AddAuthorization();
            })
            .Configure(app =>
            {
                app.UseRouting();
                app.UseAuthentication();
                app.UseMiddleware<JwtContextValidationMiddleware>();
                app.UseAuthorization();
                app.UseEndpoints(endpoints =>
                {
                    var endpoint = endpoints.MapGet("/protected", _ =>
                    {
                        _reachedEndpoint = true;
                        return Task.CompletedTask;
                    }).RequireAuthorization();
                    if (joining) endpoint.WithMetadata(new ControllerActionDescriptor
                    {
                        ControllerTypeInfo = typeof(UserController).GetTypeInfo(),
                        MethodInfo = typeof(UserController).GetMethod(nameof(UserController.JoinOrganizationAsync))!
                    });
                });
            })).StartAsync();
        var jwt = new JwtSecurityToken("test", "test",
            [new Claim(UserClaims.Id, _userId.ToString())],
            expires: DateTime.UtcNow.AddMinutes(5),
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));
        using var client = host.GetTestClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", new JwtSecurityTokenHandler().WriteToken(jwt));
        client.DefaultRequestHeaders.Add(ApiConstants.WorkspaceHeaderKey, _workspaceId.ToString());
        client.DefaultRequestHeaders.Add(ApiConstants.OrgIdHeaderKey,
            requestedOrganizationId.ToString());

        using var response = await client.GetAsync("/protected");

        Assert.Equal(expected, response.StatusCode);
        Assert.Equal(expected == HttpStatusCode.OK, _reachedEndpoint);
    }
}

using System.Linq.Expressions;
using System.Security.Claims;
using System.Text.Encodings.Web;
using Api;
using Api.Authentication;
using Application;
using Application.Services;
using Domain.AccessTokens;
using Domain.Organizations;
using Domain.Users;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace Api.UnitTests.Authentication;

public class OpenApiHandlerTests
{
    private const string SchemeName = Schemes.OpenApi;

    private static async Task<(OpenApiHandler handler, HttpContext ctx)> BuildHandlerAsync(
        Mock<IAccessTokenService> tokenSvc,
        Mock<IOrganizationService> orgSvc,
        string? authorizationHeader = null)
    {
        var optionsMonitor = new Mock<IOptionsMonitor<OpenApiOptions>>();
        optionsMonitor.Setup(x => x.Get(It.IsAny<string>())).Returns(new OpenApiOptions());
        optionsMonitor.Setup(x => x.CurrentValue).Returns(new OpenApiOptions());

        var handler = new OpenApiHandler(
            optionsMonitor.Object,
            NullLoggerFactory.Instance,
            UrlEncoder.Default,
            orgSvc.Object,
            tokenSvc.Object);

        var ctx = new DefaultHttpContext();
        if (authorizationHeader != null)
        {
            ctx.Request.Headers.Authorization = authorizationHeader;
        }

        var scheme = new AuthenticationScheme(SchemeName, SchemeName, typeof(OpenApiHandler));
        await handler.InitializeAsync(scheme, ctx);
        return (handler, ctx);
    }

    [Fact]
    public async Task Authenticate_NoAuthorizationHeader_ReturnsNoResult()
    {
        var tokenSvc = new Mock<IAccessTokenService>();
        var orgSvc = new Mock<IOrganizationService>();
        var (handler, _) = await BuildHandlerAsync(tokenSvc, orgSvc, authorizationHeader: null);

        var result = await handler.AuthenticateAsync();

        Assert.False(result.Succeeded);
        Assert.True(result.None);
        tokenSvc.Verify(
            x => x.FindOneAsync(It.IsAny<Expression<Func<AccessToken, bool>>>()),
            Times.Never);
    }

    [Fact]
    public async Task Authenticate_TokenNotFoundOrInactive_FailsAuthentication()
    {
        var tokenSvc = new Mock<IAccessTokenService>();
        tokenSvc.Setup(x => x.FindOneAsync(It.IsAny<Expression<Func<AccessToken, bool>>>()))
            .ReturnsAsync((AccessToken?)null);
        var orgSvc = new Mock<IOrganizationService>();
        var (handler, _) = await BuildHandlerAsync(tokenSvc, orgSvc, "bad-token");

        var result = await handler.AuthenticateAsync();

        Assert.False(result.Succeeded);
        Assert.NotNull(result.Failure);
    }

    [Fact]
    public async Task Authenticate_ValidToken_SetsHeadersStoresTokenAndIssuesIdentity()
    {
        var orgId = Guid.NewGuid();
        var workspaceId = Guid.NewGuid();
        var creatorId = Guid.NewGuid();
        var token = new AccessToken(orgId, creatorId, "name", AccessTokenTypes.Service, permissions: [])
        {
            Id = Guid.NewGuid()
        };

        var tokenSvc = new Mock<IAccessTokenService>();
        tokenSvc.Setup(x => x.FindOneAsync(It.IsAny<Expression<Func<AccessToken, bool>>>()))
            .ReturnsAsync(token);

        var org = new Organization(workspaceId, "org", "org") { Id = orgId };
        var orgSvc = new Mock<IOrganizationService>();
        orgSvc.Setup(x => x.GetAsync(orgId)).ReturnsAsync(org);

        var (handler, ctx) = await BuildHandlerAsync(tokenSvc, orgSvc, token.Token);

        var result = await handler.AuthenticateAsync();

        Assert.True(result.Succeeded);
        Assert.Equal(workspaceId.ToString(), ctx.Request.Headers[ApiConstants.WorkspaceHeaderKey]);
        Assert.Equal(orgId.ToString(), ctx.Request.Headers[ApiConstants.OrgIdHeaderKey]);
        Assert.Same(token, ctx.Items[ApplicationConsts.AccessTokenItem]);

        Assert.NotNull(result.Principal);
        Assert.Equal(Schemes.OpenApi, result.Principal!.Identity?.AuthenticationType);
        var idClaim = result.Principal.Claims.FirstOrDefault(c => c.Type == UserClaims.Id);
        Assert.Equal(token.Id.ToString(), idClaim?.Value);
    }

    [Fact]
    public async Task Authenticate_ExceptionDuringLookup_ReturnsFailure()
    {
        var tokenSvc = new Mock<IAccessTokenService>();
        tokenSvc.Setup(x => x.FindOneAsync(It.IsAny<Expression<Func<AccessToken, bool>>>()))
            .ThrowsAsync(new InvalidOperationException("db down"));
        var orgSvc = new Mock<IOrganizationService>();
        var (handler, _) = await BuildHandlerAsync(tokenSvc, orgSvc, "some-token");

        var result = await handler.AuthenticateAsync();

        Assert.False(result.Succeeded);
        Assert.NotNull(result.Failure);
    }
}

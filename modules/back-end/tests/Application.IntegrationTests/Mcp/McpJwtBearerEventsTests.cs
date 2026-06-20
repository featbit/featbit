using System.Security.Claims;
using Api.Mcp;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;

namespace Application.IntegrationTests.Mcp;

public class McpJwtBearerEventsTests
{
    [Fact]
    public async Task NonMcpTokenIsAccepted()
    {
        var context = CreateContext("/api/v1/user/profile", []);
        var events = new McpJwtBearerEvents(new McpDeviceAuthorizationStore());

        await events.TokenValidated(context);

        Assert.Null(context.Result?.Failure);
    }

    [Fact]
    public async Task McpTokenCannotBeUsedOutsideMcpEndpoint()
    {
        var context = CreateContext("/api/v1/user/profile",
        [
            new Claim(McpClaimTypes.TokenType, McpClaimTypes.McpTokenType),
            new Claim(JwtRegisteredClaimNames.Jti, "token-1")
        ]);
        var events = new McpJwtBearerEvents(new McpDeviceAuthorizationStore());

        await events.TokenValidated(context);

        Assert.NotNull(context.Result?.Failure);
    }

    [Fact]
    public async Task McpTokenRequiresTokenId()
    {
        var context = CreateContext("/mcp",
        [
            new Claim(McpClaimTypes.TokenType, McpClaimTypes.McpTokenType)
        ]);
        var events = new McpJwtBearerEvents(new McpDeviceAuthorizationStore());

        await events.TokenValidated(context);

        Assert.NotNull(context.Result?.Failure);
    }

    [Fact]
    public async Task RevokedMcpTokenIsRejected()
    {
        var store = new McpDeviceAuthorizationStore();
        var authorization = store.Create("client-1", Guid.NewGuid(), null);
        authorization.Approve(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
        var tokenId = store.CreateAccessTokenSession(authorization, DateTime.UtcNow.AddMinutes(5));
        store.RevokeAccessToken(tokenId);
        var context = CreateContext("/mcp",
        [
            new Claim(McpClaimTypes.TokenType, McpClaimTypes.McpTokenType),
            new Claim(JwtRegisteredClaimNames.Jti, tokenId)
        ]);
        var events = new McpJwtBearerEvents(store);

        await events.TokenValidated(context);

        Assert.NotNull(context.Result?.Failure);
    }

    private static TokenValidatedContext CreateContext(string path, IEnumerable<Claim> claims)
    {
        var httpContext = new DefaultHttpContext();
        httpContext.Request.Path = path;
        var scheme = new AuthenticationScheme(
            JwtBearerDefaults.AuthenticationScheme,
            JwtBearerDefaults.AuthenticationScheme,
            typeof(JwtBearerHandler));
        var options = Options.Create(new JwtBearerOptions());
        var context = new TokenValidatedContext(httpContext, scheme, options.Value)
        {
            Principal = new ClaimsPrincipal(new ClaimsIdentity(claims, JwtBearerDefaults.AuthenticationScheme))
        };

        return context;
    }
}

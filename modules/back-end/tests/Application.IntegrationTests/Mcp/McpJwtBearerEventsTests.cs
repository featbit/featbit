using System.Security.Claims;
using Api.Mcp;
using Application.Services;
using Domain.Mcp;
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
        var events = new McpJwtBearerEvents(new TestMcpAuthorizationStore());

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
        var events = new McpJwtBearerEvents(new TestMcpAuthorizationStore(activeTokenIds: ["token-1"]));

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
        var events = new McpJwtBearerEvents(new TestMcpAuthorizationStore());

        await events.TokenValidated(context);

        Assert.NotNull(context.Result?.Failure);
    }

    [Fact]
    public async Task RevokedMcpTokenIsRejected()
    {
        const string tokenId = "token-1";
        var store = new TestMcpAuthorizationStore(revokedTokenIds: [tokenId]);
        var context = CreateContext("/mcp",
        [
            new Claim(McpClaimTypes.TokenType, McpClaimTypes.McpTokenType),
            new Claim(JwtRegisteredClaimNames.Jti, tokenId)
        ]);
        var events = new McpJwtBearerEvents(store);

        await events.TokenValidated(context);

        Assert.NotNull(context.Result?.Failure);
    }

    [Fact]
    public async Task UnknownMcpTokenIsRejected()
    {
        var context = CreateContext("/mcp",
        [
            new Claim(McpClaimTypes.TokenType, McpClaimTypes.McpTokenType),
            new Claim(JwtRegisteredClaimNames.Jti, "token-1")
        ]);
        var events = new McpJwtBearerEvents(new TestMcpAuthorizationStore());

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

    private sealed class TestMcpAuthorizationStore(
        string[]? activeTokenIds = null,
        string[]? revokedTokenIds = null) : IMcpAuthorizationStore
    {
        private readonly HashSet<string> _activeTokenIds = new(activeTokenIds ?? []);
        private readonly HashSet<string> _revokedTokenIds = new(revokedTokenIds ?? []);

        public Task<(McpDeviceAuthorization Authorization, string DeviceCode)> CreateDeviceAuthorizationAsync(
            string clientId,
            Guid envId,
            Guid? experimentId) => throw new NotSupportedException();

        public Task<McpDeviceAuthorization?> FindDeviceAuthorizationByDeviceCodeAsync(string deviceCode) =>
            throw new NotSupportedException();

        public Task<McpDeviceAuthorization?> FindDeviceAuthorizationByUserCodeAsync(string userCode) =>
            throw new NotSupportedException();

        public Task ApproveDeviceAuthorizationAsync(
            McpDeviceAuthorization authorization,
            Guid userId,
            Guid organizationId,
            Guid workspaceId) => throw new NotSupportedException();

        public Task RemoveDeviceAuthorizationAsync(McpDeviceAuthorization authorization) =>
            throw new NotSupportedException();

        public Task<string> CreateRefreshTokenAsync(McpDeviceAuthorization authorization) =>
            throw new NotSupportedException();

        public Task<string> CreateAccessTokenSessionAsync(McpDeviceAuthorization authorization, DateTime expiresAt) =>
            throw new NotSupportedException();

        public Task<string> CreateAccessTokenSessionAsync(McpRefreshAuthorization authorization, DateTime expiresAt) =>
            throw new NotSupportedException();

        public Task<(string RefreshToken, McpRefreshAuthorization Authorization)?> RotateRefreshTokenAsync(
            string refreshToken,
            string clientId) => throw new NotSupportedException();

        public Task<bool> IsAccessTokenRevokedAsync(string tokenId) =>
            Task.FromResult(_revokedTokenIds.Contains(tokenId));

        public Task<bool> IsAccessTokenActiveAsync(string tokenId) =>
            Task.FromResult(_activeTokenIds.Contains(tokenId));

        public Task<bool> RevokeAccessTokenAsync(string tokenId) => throw new NotSupportedException();
    }
}

using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.JsonWebTokens;

namespace Api.Mcp;

public class McpJwtBearerEvents(McpDeviceAuthorizationStore store) : JwtBearerEvents
{
    public override Task TokenValidated(TokenValidatedContext context)
    {
        var principal = context.Principal;
        var tokenType = principal?.FindFirst(McpClaimTypes.TokenType)?.Value;
        if (tokenType != McpClaimTypes.McpTokenType)
        {
            return Task.CompletedTask;
        }

        if (!context.Request.Path.StartsWithSegments("/mcp"))
        {
            context.Fail("MCP tokens can only be used with the MCP endpoint.");
            return Task.CompletedTask;
        }

        var tokenId = principal?.FindFirst(JwtRegisteredClaimNames.Jti)?.Value;
        if (string.IsNullOrWhiteSpace(tokenId))
        {
            context.Fail("MCP token is missing a token id.");
            return Task.CompletedTask;
        }

        if (!store.IsAccessTokenActive(tokenId))
        {
            context.Fail("MCP token has expired or been revoked.");
        }

        return Task.CompletedTask;
    }
}

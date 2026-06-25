using Microsoft.AspNetCore.Authentication.JwtBearer;
using Application.Services;
using Microsoft.IdentityModel.JsonWebTokens;

namespace Api.Mcp;

public class McpJwtBearerEvents(IMcpAuthorizationStore store) : JwtBearerEvents
{
    public override async Task TokenValidated(TokenValidatedContext context)
    {
        var principal = context.Principal;
        var tokenType = principal?.FindFirst(McpClaimTypes.TokenType)?.Value;
        if (tokenType != McpClaimTypes.McpTokenType)
        {
            return;
        }

        if (!context.Request.Path.StartsWithSegments("/mcp"))
        {
            context.Fail("MCP tokens can only be used with the MCP endpoint.");
            return;
        }

        var tokenId = principal?.FindFirst(JwtRegisteredClaimNames.Jti)?.Value;
        if (string.IsNullOrWhiteSpace(tokenId))
        {
            context.Fail("MCP token is missing a token id.");
            return;
        }

        if (await store.IsAccessTokenRevokedAsync(tokenId))
        {
            context.Fail("MCP token has been revoked.");
            return;
        }

        if (!await store.IsAccessTokenActiveAsync(tokenId))
        {
            context.Fail("MCP token is expired or unknown.");
        }
    }
}

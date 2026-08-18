using Api.Mcp;
using Application.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.JsonWebTokens;

namespace Api.Authentication;

public class DefaultJwtBearerEvents(IMcpAuthorizationStore mcpStore) : JwtBearerEvents
{
    public override async Task TokenValidated(TokenValidatedContext context)
    {
        if (IsMcpToken(context))
        {
            await ValidateMcpTokenAsync(context);
        }
    }

    private async Task ValidateMcpTokenAsync(TokenValidatedContext context)
    {
        if (!context.Request.Path.StartsWithSegments("/mcp"))
        {
            context.Fail("MCP tokens can only be used with the MCP endpoint.");
            return;
        }

        var tokenId = context.Principal?.FindFirst(JwtRegisteredClaimNames.Jti)?.Value;
        if (string.IsNullOrWhiteSpace(tokenId))
        {
            context.Fail("MCP token is missing a token id.");
            return;
        }

        if (await mcpStore.IsAccessTokenRevokedAsync(tokenId))
        {
            context.Fail("MCP token has been revoked.");
            return;
        }

        if (!await mcpStore.IsAccessTokenActiveAsync(tokenId))
        {
            context.Fail("MCP token is expired or unknown.");
        }
    }

    private static bool IsMcpToken(TokenValidatedContext context)
    {
        var tokenType = context.Principal?.FindFirst(McpClaimTypes.TokenType)?.Value;

        return tokenType == McpClaimTypes.McpTokenType;
    }
}

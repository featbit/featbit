using System.Security.Claims;
using Api;
using Api.Mcp;
using Microsoft.AspNetCore.Http;

namespace Api.UnitTests;

public class HttpRequestExtensionsTests
{
    [Theory]
    [InlineData(false, "valid")]
    [InlineData(false, null)]
    [InlineData(false, "invalid")]
    [InlineData(true, "valid")]
    [InlineData(true, null)]
    [InlineData(true, "invalid")]
    public void TenantIds_UseOnlyTheSelectedSource(bool mcpToken, string? value)
    {
        var expected = value == "valid" ? Guid.NewGuid() : Guid.Empty;
        var selected = value == "valid" ? expected.ToString() : value;
        var other = Guid.NewGuid().ToString();
        var header = mcpToken ? other : selected;
        var claim = mcpToken ? selected : other;
        var context = new DefaultHttpContext();
        context.Request.Headers[ApiConstants.OrgIdHeaderKey] = header;
        context.Request.Headers[ApiConstants.WorkspaceHeaderKey] = header;
        var identity = new ClaimsIdentity();
        if (mcpToken)
            identity.AddClaim(new Claim(McpClaimTypes.TokenType, McpClaimTypes.McpTokenType));
        if (claim != null)
        {
            identity.AddClaim(new Claim(McpClaimTypes.OrgId, claim));
            identity.AddClaim(new Claim(McpClaimTypes.WorkspaceId, claim));
        }
        context.User = new ClaimsPrincipal(identity);

        Assert.Equal(expected, context.Request.OrganizationId());
        Assert.Equal(expected, context.Request.WorkspaceId());
    }
}

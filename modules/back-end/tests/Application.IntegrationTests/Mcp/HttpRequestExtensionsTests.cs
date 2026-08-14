using System.Security.Claims;
using Api;
using Api.Mcp;
using Microsoft.AspNetCore.Http;

namespace Application.IntegrationTests.Mcp;

public class HttpRequestExtensionsTests
{
    [Fact]
    public void OrganizationIdUsesHeaderBeforeClaim()
    {
        var headerOrgId = Guid.NewGuid();
        var claimOrgId = Guid.NewGuid();
        var context = new DefaultHttpContext();
        context.Request.Headers[ApiConstants.OrgIdHeaderKey] = headerOrgId.ToString();
        context.User = new ClaimsPrincipal(new ClaimsIdentity(
        [
            new Claim(McpClaimTypes.OrgId, claimOrgId.ToString())
        ]));

        Assert.Equal(headerOrgId, context.Request.OrganizationId());
    }

    [Fact]
    public void WorkspaceIdFallsBackToMcpClaim()
    {
        var workspaceId = Guid.NewGuid();
        var context = new DefaultHttpContext();
        context.User = new ClaimsPrincipal(new ClaimsIdentity(
        [
            new Claim(McpClaimTypes.WorkspaceId, workspaceId.ToString())
        ]));

        Assert.Equal(workspaceId, context.Request.WorkspaceId());
    }

    [Fact]
    public void MissingOrMalformedContextReturnsEmptyGuid()
    {
        var context = new DefaultHttpContext();
        context.Request.Headers[ApiConstants.OrgIdHeaderKey] = "not-a-guid";
        context.User = new ClaimsPrincipal(new ClaimsIdentity(
        [
            new Claim(McpClaimTypes.WorkspaceId, "not-a-guid")
        ]));

        Assert.Equal(Guid.Empty, context.Request.OrganizationId());
        Assert.Equal(Guid.Empty, context.Request.WorkspaceId());
    }
}

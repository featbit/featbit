using Api.Mcp;

namespace Api;

public static class HttpRequestExtensions
{
    public static Guid OrganizationId(this HttpRequest request)
    {
        // MCP tokens are bound to their signed tenant context, never caller-supplied headers.
        if (request.HttpContext.User.FindFirst(McpClaimTypes.TokenType)?.Value == McpClaimTypes.McpTokenType)
        {
            return Guid.TryParse(request.HttpContext.User.FindFirst(McpClaimTypes.OrgId)?.Value, out var scopedId)
                ? scopedId
                : Guid.Empty;
        }

        return Guid.TryParse(request.Headers[ApiConstants.OrgIdHeaderKey], out var orgId)
            ? orgId
            : Guid.Empty;
    }

    public static Guid WorkspaceId(this HttpRequest request)
    {
        // MCP tokens are bound to their signed tenant context, never caller-supplied headers.
        if (request.HttpContext.User.FindFirst(McpClaimTypes.TokenType)?.Value == McpClaimTypes.McpTokenType)
        {
            return Guid.TryParse(request.HttpContext.User.FindFirst(McpClaimTypes.WorkspaceId)?.Value, out var scopedId)
                ? scopedId
                : Guid.Empty;
        }

        return Guid.TryParse(request.Headers[ApiConstants.WorkspaceHeaderKey], out var workspaceId)
            ? workspaceId
            : Guid.Empty;
    }

    public static string? RefreshToken(this HttpRequest request)
    {
        var cookies = request.Cookies;

        return cookies.TryGetValue(ApiConstants.RefreshTokenCookieName, out var refreshToken)
            ? refreshToken
            : null;
    }

    public static string ClientIpAddress(this HttpRequest request)
    {
        // x-forwarded-for header
        // https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Forwarded-For
        if (request.Headers.TryGetValue("X-Forwarded-For", out var forwardForHeaders))
        {
            var headerValue = forwardForHeaders.FirstOrDefault(string.Empty);
            if (!string.IsNullOrEmpty(headerValue))
            {
                // X-Forwarded-For can contain multiple IPs (client, proxy1, proxy2...)
                // The first IP is the original client IP
                return headerValue.Split(',')[0].Trim();
            }
        }

        // cloudflare connecting IP header
        // https://developers.cloudflare.com/fundamentals/reference/http-request-headers/#cf-connecting-ip
        if (request.Headers.TryGetValue("CF-Connecting-IP", out var cfConnectingIpHeaders))
        {
            var headerValue = cfConnectingIpHeaders.FirstOrDefault(string.Empty);
            if (!string.IsNullOrEmpty(headerValue))
            {
                return headerValue;
            }
        }

        var remoteIpAddr = request.HttpContext.Connection.RemoteIpAddress?.ToString();
        return remoteIpAddr ?? string.Empty;
    }
}

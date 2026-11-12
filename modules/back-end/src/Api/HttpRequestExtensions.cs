using Api.Mcp;

namespace Api;

public static class HttpRequestExtensions
{
    public static Guid OrganizationId(this HttpRequest request)
    {
        var orgIdClaim = request.HttpContext.User.Claims.FirstOrDefault(x => x.Type == McpClaimTypes.OrgId)?.Value;
        if (Guid.TryParse(orgIdClaim, out var orgId))
            return orgId;

        return Guid.TryParse(request.Headers[ApiConstants.OrgIdHeaderKey], out orgId)
            ? orgId
            : Guid.Empty;
    }

    public static Guid WorkspaceId(this HttpRequest request)
    {
        var workspaceIdClaim = request.HttpContext.User.Claims.FirstOrDefault(x => x.Type == McpClaimTypes.WorkspaceId)?.Value;
        if (Guid.TryParse(workspaceIdClaim, out var workspaceId))
            return workspaceId;

        return Guid.TryParse(request.Headers[ApiConstants.WorkspaceHeaderKey], out workspaceId)
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

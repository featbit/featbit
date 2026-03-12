namespace Api;

public static class HttpRequestExtensions
{
    public static Guid OrganizationId(this HttpRequest request)
    {
        var orgIdHeaderValue = request.Headers[ApiConstants.OrgIdHeaderKey];

        return Guid.TryParse(orgIdHeaderValue, out var orgId)
            ? orgId
            : Guid.Empty;
    }

    public static Guid WorkspaceId(this HttpRequest request)
    {
        var workspaceIdHeaderValue = request.Headers[ApiConstants.WorkspaceHeaderKey];

        return Guid.TryParse(workspaceIdHeaderValue, out var workspaceId)
            ? workspaceId
            : Guid.Empty;
    }
}
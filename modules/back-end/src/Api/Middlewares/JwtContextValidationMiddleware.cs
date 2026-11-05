using Api.Authentication;
using Api.Authorization;
using Api.Mcp;
using Application.Services;
using Domain.Users;
using Microsoft.AspNetCore.Authorization;

namespace Api.Middlewares;

public class JwtContextValidationMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, IUserService users, IOrganizationService organizations,
        ISsoOrganizationJoinAuthorization joinAuthorization)
    {
        if (context.User.Identity is not { IsAuthenticated: true, AuthenticationType: Schemes.JwtBearer } ||
            context.GetEndpoint()?.Metadata.GetMetadata<IAllowAnonymous>() != null)
        {
            await next(context);
            return;
        }

        if (!await IsValidAsync(context, users, organizations, joinAuthorization))
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            return;
        }

        await next(context);
    }

    private static async Task<bool> IsValidAsync(
        HttpContext context, IUserService users, IOrganizationService organizations,
        ISsoOrganizationJoinAuthorization joinAuthorization)
    {
        var workspaceHeader = context.Request.Headers[ApiConstants.WorkspaceHeaderKey];
        var organizationHeader = context.Request.Headers[ApiConstants.OrgIdHeaderKey];
        var workspaceValue = workspaceHeader.ToString();
        var organizationValue = organizationHeader.ToString();
        var metadata = context.GetEndpoint()?.Metadata;
        if (metadata?.GetMetadata<TenantContextFromEnvironmentAttribute>() != null)
        {
            if (!Guid.TryParse(context.Request.RouteValues["envId"]?.ToString(), out var envId) || envId == Guid.Empty)
                return false;

            var environments = context.RequestServices.GetRequiredService<IEnvironmentService>();
            var descriptor = await environments.GetResourceDescriptorAsync(envId);
            if (descriptor == null) return false;
            var organization = await organizations.FindOneAsync(org => org.Id == descriptor.Organization.Id);
            if (organization == null) return false;

            if ((workspaceHeader.Count > 0 &&
                 (!Guid.TryParse(workspaceValue, out var suppliedWorkspace) || suppliedWorkspace != organization.WorkspaceId)) ||
                (organizationHeader.Count > 0 &&
                 (!Guid.TryParse(organizationValue, out var suppliedOrganization) || suppliedOrganization != organization.Id)))
                return false;

            workspaceValue = organization.WorkspaceId.ToString();
            organizationValue = organization.Id.ToString();
            context.Request.Headers[ApiConstants.WorkspaceHeaderKey] = workspaceValue;
            context.Request.Headers[ApiConstants.OrgIdHeaderKey] = organizationValue;
        }
        // MCP tokens carry their tenant context in signed claims rather than request headers.
        if (context.User.FindFirst(McpClaimTypes.TokenType)?.Value == McpClaimTypes.McpTokenType)
        {
            var workspaceClaim = context.User.FindFirst(McpClaimTypes.WorkspaceId)?.Value;
            var organizationClaim = context.User.FindFirst(McpClaimTypes.OrgId)?.Value;
            if ((workspaceHeader.Count > 0 && workspaceValue != workspaceClaim) ||
                (organizationHeader.Count > 0 && organizationValue != organizationClaim))
            {
                return false;
            }
            workspaceValue = workspaceClaim;
            organizationValue = organizationClaim;
        }

        var hasWorkspace = !string.IsNullOrEmpty(workspaceValue);
        var hasOrganization = !string.IsNullOrEmpty(organizationValue);
        var joining = metadata?.GetMetadata<AllowOrganizationJoinAttribute>() != null;
        var requirement = joining
            ? TenantContextRequirement.WorkspaceAndOrganization
            : metadata?.GetMetadata<TenantContextAttribute>()?.Requirement
              ?? TenantContextRequirement.WorkspaceAndOrganization;
        if ((requirement != TenantContextRequirement.None && !hasWorkspace) ||
            (requirement == TenantContextRequirement.WorkspaceAndOrganization && !hasOrganization))
        {
            return false;
        }

        if (!hasWorkspace && !hasOrganization)
        {
            return true;
        }

        if (!Guid.TryParse(context.User.FindFirst(UserClaims.Id)?.Value, out var userId) ||
            userId == Guid.Empty ||
            !Guid.TryParse(workspaceValue, out var workspaceId) || workspaceId == Guid.Empty)
        {
            return false;
        }

        if (!hasOrganization)
        {
            var userWorkspaces = await users.GetWorkspacesAsync(userId);
            return userWorkspaces.Any(workspace => workspace.Id == workspaceId);
        }

        if (!Guid.TryParse(organizationValue, out var organizationId) || organizationId == Guid.Empty)
        {
            return false;
        }

        // The join authorization service owns the complete membership/ownership check for this endpoint.
        if (joining)
        {
            var authorization = await joinAuthorization.GetJoinAuthorizationAsync(workspaceId, organizationId, userId);
            return authorization.IsAllowed;
        }

        var workspaces = await users.GetWorkspacesAsync(userId);
        if (!workspaces.Any(workspace => workspace.Id == workspaceId))
        {
            return false;
        }

        if (!await organizations.AnyAsync(org => org.Id == organizationId && org.WorkspaceId == workspaceId))
        {
            return false;
        }

        return await organizations.ContainsUserAsync(organizationId, userId);
    }
}

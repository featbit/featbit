using Application.Services;
using Domain.Users;

namespace Api.Authorization;

public class TenantAccessValidator(IUserService userService, IOrganizationService organizationService)
    : ITenantAccessValidator
{
    public async Task<bool> ValidateAsync(HttpContext context)
    {
        var requirement =
            context.GetEndpoint()?.Metadata.GetMetadata<TenantContextAttribute>()?.Requirement ??
            TenantContextRequirement.WorkspaceAndOrganization;

        // No tenant context validation is required for this endpoint.
        if (requirement == TenantContextRequirement.None)
        {
            return true;
        }

        // A valid user ID is required
        var userIdValue = context.User.FindFirst(UserClaims.Id)?.Value;
        if (!Guid.TryParse(userIdValue, out var userId) || userId == Guid.Empty)
        {
            return false;
        }

        // A valid workspace ID is required
        var workspaceHeader = context.Request.Headers[ApiConstants.WorkspaceHeaderKey];
        if (!Guid.TryParse(workspaceHeader.ToString(), out var workspaceId) || workspaceId == Guid.Empty)
        {
            return false;
        }

        // Validate workspace
        if (requirement == TenantContextRequirement.Workspace)
        {
            var userWorkspaces = await userService.GetWorkspacesAsync(userId);
            return userWorkspaces.Any(workspace => workspace.Id == workspaceId);
        }

        // Validate workspace and organization
        var organizationHeader = context.Request.Headers[ApiConstants.OrgIdHeaderKey];
        if (!Guid.TryParse(organizationHeader.ToString(), out var organizationId) || organizationId == Guid.Empty)
        {
            return false;
        }

        var workspaces = await userService.GetWorkspacesAsync(userId);
        if (workspaces.All(workspace => workspace.Id != workspaceId))
        {
            return false;
        }

        if (!await organizationService.AnyAsync(org => org.Id == organizationId && org.WorkspaceId == workspaceId))
        {
            return false;
        }

        return await organizationService.ContainsUserAsync(organizationId, userId);
    }
}

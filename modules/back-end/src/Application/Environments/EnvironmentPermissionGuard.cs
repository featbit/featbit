#nullable enable
using Domain.Policies;

namespace Application.Environments;

public class EnvironmentPermissionGuard(
    IPermissionTargetResolver targetResolver,
    IOrganizationPermissions organizationPermissions)
{
    public async Task<bool> CanAccessAsync(Guid envId)
    {
        var target = await targetResolver.ResolveEnvironmentAsync(envId);
        if (target?.OrganizationId is not { } organizationId)
        {
            return false;
        }

        var permissions = await organizationPermissions.GetAsync(organizationId);
        return PolicyHelper.IsAllowed(permissions, target.Rn, Permissions.CanAccessEnv);
    }
}

using Application.Bases.Exceptions;
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

    public async Task<string> EnsureAccessAsync(Guid organizationId, Guid envId, PolicyStatement[] statements)
    {
        if (organizationId == Guid.Empty)
        {
            throw new ForbiddenException();
        }

        var target = await targetResolver.ResolveEnvironmentAsync(envId);
        if (string.IsNullOrWhiteSpace(target?.Rn) || 
            target.OrganizationId != organizationId ||
            !PolicyHelper.IsAllowed(statements, target.Rn, Permissions.CanAccessEnv))
        {
            throw new ForbiddenException();
        }

        return target.Rn;
    }
}

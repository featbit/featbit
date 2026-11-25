#nullable enable
using Application.Bases.Exceptions;
using Domain.Policies;
using Domain.Resources;

namespace Application.Policies;

internal static class PermissionChecks
{
    internal static async Task EnsureAllowedAsync(
        Guid organizationId,
        IEnumerable<string> instructionPermissions,
        PolicyStatement[] policies,
        Func<Task<PermissionTarget?>> targetResolver)
    {
        var permissionTarget = await ResolveAccessibleTargetAsync(organizationId, targetResolver);

        var requiredPermissions = instructionPermissions
            .Where(permission => !string.IsNullOrEmpty(permission))
            .ToHashSet();

        if (requiredPermissions.Any(permission => !PolicyHelper.IsAllowed(policies, permissionTarget.Rn, permission)))
        {
            throw new ForbiddenException();
        }
    }

    internal static async Task<PermissionTarget> ResolveAccessibleTargetAsync(
        Guid organizationId,
        Func<Task<PermissionTarget?>> targetResolver)
    {
        if (organizationId == Guid.Empty)
        {
            throw new ForbiddenException();
        }

        var permissionTarget = await targetResolver();
        if (string.IsNullOrWhiteSpace(permissionTarget?.Rn) || permissionTarget.OrganizationId != organizationId)
        {
            throw new ForbiddenException();
        }

        return permissionTarget;
    }
}

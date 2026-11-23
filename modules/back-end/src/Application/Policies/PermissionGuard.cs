#nullable enable
using Application.Bases.Exceptions;
using Domain.AuditLogs;
using Domain.FeatureFlags;
using Domain.Policies;
using Domain.Resources;
using Domain.Segments;
using Domain.SemanticPatch;

namespace Application.Policies;

public class PermissionGuard(IPermissionTargetResolver targetResolver) : IPermissionGuard
{
    public Task EnsureFlagOwnershipAsync(Guid organizationId, FeatureFlag flag) =>
        EnsureOwnershipAsync(organizationId, () => targetResolver.ResolveFlagAsync(flag.EnvId, flag.Key));

    public Task EnsureSegmentOwnershipAsync(Guid organizationId, Segment segment) =>
        EnsureOwnershipAsync(organizationId, () => targetResolver.ResolveSegmentAsync(segment.EnvId, segment.Id));

    public Task EnsureFlagChangeAllowedAsync(Guid organizationId, FeatureFlag flag, DataChange change, PolicyStatement[] permissions) =>
        EnsureAllowedAsync(
            organizationId,
            FlagComparer.Compare(change).Select(instruction => instruction.Permission),
            permissions,
            () => targetResolver.ResolveFlagAsync(flag.EnvId, flag.Key)
        );

    public Task EnsureSegmentChangeAllowedAsync(Guid organizationId, Segment segment, DataChange change, PolicyStatement[] permissions) =>
        EnsureAllowedAsync(
            organizationId,
            SegmentComparer.Compare(change).Select(instruction => instruction.Permission),
            permissions,
            () => targetResolver.ResolveSegmentAsync(segment.EnvId, segment.Id)
        );

    private static async Task EnsureAllowedAsync(
        Guid organizationId,
        IEnumerable<string> instructionPermissions,
        PolicyStatement[] policies,
        Func<Task<PermissionTarget?>> targetResolver)
    {
        var permissionTarget = await EnsureOwnershipAsync(organizationId, targetResolver);

        var requiredPermissions = instructionPermissions
            .Where(permission => !string.IsNullOrEmpty(permission))
            .ToHashSet();

        if (requiredPermissions.Any(permission => !PolicyHelper.IsAllowed(policies, permissionTarget.Rn, permission)))
        {
            throw new ForbiddenException();
        }
    }

    private static async Task<PermissionTarget> EnsureOwnershipAsync(
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

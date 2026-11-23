#nullable enable
using Application.Bases.Exceptions;
using Domain.AuditLogs;
using Domain.FeatureFlags;
using Domain.Policies;
using Domain.Resources;
using Domain.Segments;
using Domain.SemanticPatch;

namespace Application.Policies;

public class PermissionGuard(IResourcePermissionTargetResolver targetResolver) : IPermissionGuard
{
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
        Func<Task<ResourcePermissionTarget?>> rptResolver)
    {
        if (organizationId == Guid.Empty)
        {
            throw new ForbiddenException();
        }

        var permissionTarget = await rptResolver();
        if (string.IsNullOrWhiteSpace(permissionTarget?.Rn) || permissionTarget.OrganizationId != organizationId)
        {
            throw new ForbiddenException();
        }

        var requiredPermissions = instructionPermissions
            .Where(permission => !string.IsNullOrEmpty(permission))
            .ToHashSet();

        if (requiredPermissions.Any(permission => !PolicyHelper.IsAllowed(policies, permissionTarget.Rn, permission)))
        {
            throw new ForbiddenException();
        }
    }
}

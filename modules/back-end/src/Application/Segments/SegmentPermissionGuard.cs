#nullable enable
using Application.Policies;
using Domain.AuditLogs;
using Domain.Policies;
using Domain.SemanticPatch;

namespace Application.Segments;

public class SegmentPermissionGuard(IPermissionTargetResolver targetResolver)
{
    public Task EnsureAccessibleAsync(Guid organizationId, Guid envId, Guid segmentId) =>
        PermissionChecks.ResolveAccessibleTargetAsync(organizationId, () => targetResolver.ResolveSegmentAsync(envId, segmentId));

    public Task EnsureChangeAllowedAsync(
        Guid organizationId,
        Guid envId,
        Guid segmentId,
        DataChange change,
        PolicyStatement[] permissions) =>
        PermissionChecks.EnsureAllowedAsync(
            organizationId,
            SegmentComparer.Compare(change).Select(instruction => instruction.Permission),
            permissions,
            () => targetResolver.ResolveSegmentAsync(envId, segmentId)
        );
}

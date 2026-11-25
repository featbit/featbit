#nullable enable
using Domain.AuditLogs;
using Domain.FeatureFlags;
using Domain.Policies;
using Domain.SemanticPatch;

namespace Application.Policies;

public class PermissionGuard(IPermissionTargetResolver targetResolver) : IPermissionGuard
{
    public Task EnsureFlagOwnershipAsync(Guid organizationId, FeatureFlag flag) =>
        PermissionChecks.ResolveAccessibleTargetAsync(organizationId, () => targetResolver.ResolveFlagAsync(flag.EnvId, flag.Key));

    public Task EnsureFlagChangeAllowedAsync(Guid organizationId, FeatureFlag flag, DataChange change, PolicyStatement[] permissions) =>
        PermissionChecks.EnsureAllowedAsync(
            organizationId,
            FlagComparer.Compare(change).Select(instruction => instruction.Permission),
            permissions,
            () => targetResolver.ResolveFlagAsync(flag.EnvId, flag.Key)
        );
}

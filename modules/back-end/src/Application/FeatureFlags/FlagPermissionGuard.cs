using Application.Policies;
using Domain.AuditLogs;
using Domain.FeatureFlags;
using Domain.Policies;
using Domain.SemanticPatch;

namespace Application.FeatureFlags;

public class FlagPermissionGuard(IPermissionTargetResolver targetResolver)
{
    public Task EnsureInOrganizationAsync(Guid organizationId, FeatureFlag flag) =>
        PermissionGuard.ResolveAccessibleTargetAsync(organizationId, () => targetResolver.ResolveFlagAsync(flag.EnvId, flag.Key));

    public Task EnsureFlagChangeAllowedAsync(Guid organizationId, FeatureFlag flag, DataChange change, PolicyStatement[] permissions) =>
        PermissionGuard.EnsureAllowedAsync(
            organizationId,
            FlagComparer.Compare(change).Select(instruction => instruction.Permission),
            permissions,
            () => targetResolver.ResolveFlagAsync(flag.EnvId, flag.Key)
        );
}

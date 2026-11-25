using Domain.AuditLogs;
using Domain.FeatureFlags;
using Domain.Policies;

namespace Application.Services;

public interface IPermissionGuard
{
    /// <summary>
    /// Ensures the flag belongs to the request organization; otherwise throws ForbiddenException.
    /// </summary>
    Task EnsureFlagOwnershipAsync(Guid organizationId, FeatureFlag flag);

    /// <summary>
    /// Throws <see cref="Bases.Exceptions.ForbiddenException"/> if ownership is invalid or the given policy statements do not grant every
    /// permission required by the semantic instructions derived from the feature flag change.
    /// </summary>
    Task EnsureFlagChangeAllowedAsync(Guid organizationId, FeatureFlag flag, DataChange change, PolicyStatement[] permissions);
}

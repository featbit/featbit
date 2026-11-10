using Domain.AuditLogs;
using Domain.FeatureFlags;
using Domain.Policies;
using Domain.Segments;

namespace Application.Services;

public interface IPermissionGuard
{
    /// <summary>
    /// Validates organization ownership even when there are no changes.
    /// Throws <see cref="Bases.Exceptions.ForbiddenException"/> if ownership is invalid or the given policy statements do not grant every
    /// permission required by the semantic instructions derived from the feature flag change.
    /// </summary>
    Task EnsureFlagChangeAllowedAsync(Guid organizationId, FeatureFlag flag, DataChange change, PolicyStatement[] permissions);

    /// <summary>
    /// Validates organization ownership even when there are no changes.
    /// Throws <see cref="Bases.Exceptions.ForbiddenException"/> if ownership is invalid or the given policy statements do not grant every
    /// permission required by the semantic instructions derived from the segment change.
    /// </summary>
    Task EnsureSegmentChangeAllowedAsync(Guid organizationId, Segment segment, DataChange change, PolicyStatement[] permissions);
}

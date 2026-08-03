using Domain.AuditLogs;
using Domain.FeatureFlags;
using Domain.Policies;
using Domain.Segments;

namespace Application.Services;

public interface IPermissionGuard
{
    /// <summary>
    /// Throws <see cref="Bases.Exceptions.ForbiddenException"/> if the given policy statements do not grant every
    /// permission required by the semantic instructions derived from the feature flag change.
    /// </summary>
    Task EnsureFlagChangeAllowedAsync(FeatureFlag flag, DataChange change, PolicyStatement[] permissions);

    /// <summary>
    /// Throws <see cref="Bases.Exceptions.ForbiddenException"/> if the given policy statements do not grant every
    /// permission required by the semantic instructions derived from the segment change.
    /// </summary>
    Task EnsureSegmentChangeAllowedAsync(Segment segment, DataChange change, PolicyStatement[] permissions);
}

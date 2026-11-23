#nullable enable

using Domain.Resources;

namespace Application.Services;

public interface IPermissionTargetResolver
{
    Task<PermissionTarget?> ResolveProjectAsync(Guid projectId);

    Task<PermissionTarget?> ResolveEnvironmentAsync(Guid envId);

    Task<PermissionTarget?> ResolveFlagAsync(Guid envId, string key);

    Task<PermissionTarget?> ResolveSegmentAsync(Guid envId, Guid id);
}

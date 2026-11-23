#nullable enable

using Domain.Resources;

namespace Application.Services;

public interface IResourcePermissionTargetResolver
{
    Task<ResourcePermissionTarget?> ResolveProjectAsync(Guid projectId);

    Task<ResourcePermissionTarget?> ResolveEnvironmentAsync(Guid envId);

    Task<ResourcePermissionTarget?> ResolveFlagAsync(Guid envId, string key);

    Task<ResourcePermissionTarget?> ResolveSegmentAsync(Guid envId, Guid id);
}

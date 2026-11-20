#nullable enable

using Application.Resources;
using Domain.Resources;

namespace Application.Services;

public interface IResourceService
{
    Task<IEnumerable<Resource>> GetResourcesAsync(Guid organizationId, ResourceFilter filter);

    Task<string?> GetProjectRnAsync(Guid projectId);

    Task<string?> GetEnvRnAsync(Guid envId);

    Task<string?> GetFlagRnAsync(Guid envId, string key);

    Task<string?> GetSegmentRnAsync(Guid envId, Guid id);

    Task<bool> SegmentExistsAsync(Guid id);

    Task<bool> IsProjectInOrganizationAsync(Guid organizationId, Guid projectId);

    Task<bool> IsEnvInOrganizationAsync(Guid organizationId, Guid envId, Guid? projectId = null);

    Task<Guid?> GetOrganizationWorkspaceIdAsync(Guid organizationId);
}

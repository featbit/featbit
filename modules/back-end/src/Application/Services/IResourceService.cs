#nullable enable

using Application.Resources;
using Domain.Resources;

namespace Application.Services;

public interface IResourceService
{
    Task<IEnumerable<Resource>> GetResourcesAsync(Guid organizationId, ResourceFilter filter);

    Task<ResourceRn?> GetProjectRnAsync(Guid projectId);

    Task<ResourceRn?> GetEnvRnAsync(Guid envId);

    Task<ResourceRn?> GetFlagRnAsync(Guid envId, string key);

    Task<ResourceRn?> GetSegmentRnAsync(Guid envId, Guid id);
}

public sealed record ResourceRn(string Rn, Guid? OrganizationId);

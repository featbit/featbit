using Application.Resources;
using Domain.Resources;

namespace Application.Services;

public interface IResourceService
{
    Task<IEnumerable<Resource>> GetResourcesAsync(Guid organizationId, ResourceFilter filter);

    Task<string> GetProjectRnAsync(Guid projectId);

    Task<string> GetEnvRnAsync(Guid envId);

    Task<string> GetFlagRnAsync(Guid envId, string key);
}
using Application.Resources;
using Domain.Resources;

namespace Application.Services;

public interface IResourceService
{
    Task<IEnumerable<Resource>> GetResourcesAsync(Guid organizationId, ResourceFilter filter);
}
using Domain.Resources;

namespace Application.Services;

public interface IResourceService
{
    Task<IEnumerable<Resource>> GetResourcesAsync(Guid organizationId, string type, string name);
}
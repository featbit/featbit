using Domain.Organizations;

namespace Application.Services;

public interface IOrganizationService
{
    Task<Organization> GetAsync(Guid id);

    Task<IEnumerable<Organization>> GetListAsync(Guid userId);
}
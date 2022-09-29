using Domain.Organizations;

namespace Application.Services;

public interface IOrganizationService
{
    Task<Organization> GetAsync(Guid id);

    Task<IEnumerable<Organization>> GetListAsync(Guid userId);

    Task AddAsync(Organization organization);

    Task UpdateAsync(Organization organization);
    
    Task AddUserAsync(
        OrganizationUser organizationUser,
        ICollection<Guid> policies = null,
        ICollection<Guid> groups = null
    );
}
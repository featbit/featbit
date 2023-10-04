using Domain.Organizations;

namespace Application.Services;

public interface IOrganizationService : IService<Organization>
{
    Task<Organization> GetDefaultSsoOrganizationAsync();

    Task<IEnumerable<Organization>> GetListAsync(Guid userId);

    Task AddUserAsync(
        OrganizationUser organizationUser,
        ICollection<Guid> policies = null,
        ICollection<Guid> groups = null
    );

    Task RemoveUserAsync(Guid organizationId, Guid userId);

    Task DeleteAsync(Guid id);

    Task SetLicenseAsync(Guid id, string license);
}
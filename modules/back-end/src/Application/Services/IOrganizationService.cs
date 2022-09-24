using Domain.Organizations;

namespace Application.Services;

public interface IOrganizationService
{
    Task<Organization> GetAsync(string id);

    Task<IEnumerable<Organization>> GetUserOrganizationAsync(string userId);
}
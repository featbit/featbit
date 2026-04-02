using Domain.Organizations;

namespace Application.Services;

public interface IOrganizationService : IService<Organization>
{
    Task<string[]> GetScopesAsync(ScopeString[] scopeStrings);

    Task<ICollection<Organization>> GetUserOrganizationsAsync(Guid workspaceId, Guid userId);

    Task<bool> HasKeyBeenUsedAsync(Guid workspaceId, string key);

    Task AddUserAsync(
        OrganizationUser organizationUser,
        ICollection<Guid> policies = null,
        ICollection<Guid> groups = null
    );

    Task DeleteAsync(Guid id);
}
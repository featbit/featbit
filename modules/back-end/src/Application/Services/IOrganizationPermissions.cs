using Domain.Policies;

namespace Application.Services;

/// <summary>
/// Resolves permissions for a given organization.
/// </summary>
public interface IOrganizationPermissions
{
    Task<PolicyStatement[]> GetAsync(Guid organizationId);
}

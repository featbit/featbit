using Domain.Policies;

namespace Application.Services;

/// <summary>Resolves permissions in a specific organization without reusing another organization's policies.</summary>
public interface IOrganizationPermissions
{
    Task<PolicyStatement[]> GetAsync(Guid organizationId);
}

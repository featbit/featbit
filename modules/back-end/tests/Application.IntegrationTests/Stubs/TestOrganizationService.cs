using Application.Services;
using Domain.Organizations;
using Domain.Policies;

namespace Application.IntegrationTests.Stubs;

public class TestOrganizationService : NullServiceBase<Organization>, IOrganizationService
{
    public override Task<Organization> GetAsync(Guid id)
    {
        return Task.FromResult(new Organization(TestWorkspace.Id, "Test organization", "test-org")
        {
            Id = id,
            Initialized = true
        });
    }

    public Task<string[]> GetScopesAsync(ScopeString[] scopeStrings)
    {
        return Task.FromResult(Array.Empty<string>());
    }

    public Task<ICollection<Organization>> GetUserOrganizationsAsync(Guid workspaceId, Guid userId)
    {
        ICollection<Organization> organizations =
        [
            new Organization(workspaceId, "Test organization", "test-org")
            {
                Id = TestWorkspace.OrganizationId,
                Initialized = true
            }
        ];

        return Task.FromResult(organizations);
    }

    public Task<bool> HasKeyBeenUsedAsync(Guid workspaceId, string key)
    {
        return Task.FromResult(false);
    }

    public Task<bool> ContainsUserAsync(Guid organizationId, Guid userId)
    {
        return Task.FromResult(true);
    }

    public Task AddUserAsync(
        OrganizationUser organizationUser,
        ICollection<Guid>? policies = null,
        ICollection<Guid>? groups = null)
    {
        return Task.CompletedTask;
    }

    public Task DeleteAsync(Guid id)
    {
        return Task.CompletedTask;
    }
}

using Domain.Organizations;

namespace Application.Services;

public interface ISsoOrganizationJoinAuthorization
{
    // joinedOrganizations must be the complete server-queried membership list for this user and workspace.
    Task<bool> CanChooseOrganizationAsync(Guid workspaceId, Guid userId,
        ICollection<Organization> joinedOrganizations);

    Task<OrganizationJoinAuthorization> GetJoinAuthorizationAsync(Guid workspaceId, Guid organizationId, Guid userId);
}

public record OrganizationJoinAuthorization(bool IsAllowed, bool IsAlreadyMember);

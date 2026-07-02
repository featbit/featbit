using Application.Bases.Models;
using Application.Groups;
using Domain.Groups;

namespace Application.Services;

public interface IGroupService : IService<Group>
{
    Task DeleteAsync(Guid id);

    Task<PagedResult<Group>> GetListAsync(Guid organizationId, GroupFilter groupFilter);

    Task<PagedResult<GroupMemberVm>> GetMembersAsync(Guid organizationId, Guid groupId, GroupMemberFilter filter);

    Task<PagedResult<GroupPolicyVm>> GetPoliciesAsync(Guid organizationId, Guid groupId, GroupPolicyFilter filter);

    Task AddMemberAsync(Guid organizationId, Guid groupId, Guid memberId);

    Task RemoveMemberAsync(Guid groupId, Guid memberId);

    Task AddPolicyAsync(Guid groupId, Guid policyId);

    Task RemovePolicyAsync(Guid groupId, Guid policyId);

    Task<bool> IsNameUsedAsync(Guid organizationId, string name);
}
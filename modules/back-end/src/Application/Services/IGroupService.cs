using Application.Bases.Models;
using Application.Groups;
using Domain.Groups;

namespace Application.Services;

public interface IGroupService
{
    Task<Group> GetAsync(Guid id);

    Task<PagedResult<Group>> GetListAsync(Guid organizationId, GroupFilter groupFilter);

    Task<bool> IsNameUsedAsync(Guid organizationId, string name);

    Task<PagedResult<GroupMemberVm>> GetMembersAsync(Guid organizationId, Guid groupId, GroupMemberFilter filter);

    Task<PagedResult<GroupPolicyVm>> GetPoliciesAsync(Guid organizationId, Guid groupId, GroupPolicyFilter filter);
}
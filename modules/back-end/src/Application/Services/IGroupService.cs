using Application.Bases.Models;
using Application.Groups;
using Domain.Groups;

namespace Application.Services;

public interface IGroupService
{
    Task<Group> GetAsync(string id);

    Task<PagedResult<Group>> GetListAsync(string organizationId, GroupFilter groupFilter);

    Task<bool> IsNameUsedAsync(string organizationId, string name);

    Task<PagedResult<GroupMemberVm>> GetMembersAsync(string organizationId, string groupId, GroupMemberFilter filter);

    Task<PagedResult<GroupPolicyVm>> GetPoliciesAsync(string organizationId, string groupId, GroupPolicyFilter filter);
}
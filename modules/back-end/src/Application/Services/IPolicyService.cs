using Application.Bases.Models;
using Application.Policies;
using Domain.Policies;

namespace Application.Services;

public interface IPolicyService
{
    Task<Policy> GetAsync(string id);

    Task<PagedResult<Policy>> GetListAsync(string organizationId, PolicyFilter filter);

    Task<bool> IsNameUsedAsync(string organizationId, string name);

    Task<PagedResult<PolicyGroup>> GetGroupsAsync(string organizationId, string policyId, PolicyGroupFilter filter);

    Task<PagedResult<PolicyMember>> GetMembersAsync(string organizationId, string policyId, PolicyMemberFilter filter);
}
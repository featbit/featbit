using Application.Bases.Models;
using Application.Policies;
using Domain.Policies;

namespace Application.Services;

public interface IPolicyService
{
    Task<Policy> GetAsync(Guid id);

    Task<PagedResult<Policy>> GetListAsync(Guid organizationId, PolicyFilter filter);

    Task<bool> IsNameUsedAsync(Guid organizationId, string name);

    Task<PagedResult<PolicyGroup>> GetGroupsAsync(Guid organizationId, Guid policyId, PolicyGroupFilter filter);

    Task<PagedResult<PolicyMember>> GetMembersAsync(Guid organizationId, Guid policyId, PolicyMemberFilter filter);
}
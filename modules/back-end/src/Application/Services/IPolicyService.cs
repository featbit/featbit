using Application.Bases.Models;
using Application.Policies;
using Domain.Policies;

namespace Application.Services;

public interface IPolicyService : IService<Policy>
{
    Task DeleteAsync(Guid id);

    Task<PagedResult<Policy>> GetListAsync(Guid organizationId, PolicyFilter filter);

    Task<PagedResult<PolicyGroup>> GetGroupsAsync(Guid organizationId, Guid policyId, PolicyGroupFilter filter);

    Task<PagedResult<PolicyMember>> GetMembersAsync(Guid organizationId, Guid policyId, PolicyMemberFilter filter);

    Task<bool> IsNameUsedAsync(Guid organizationId, string name);
}
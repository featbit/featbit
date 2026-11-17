#nullable enable

using Domain.AuditLogs;
using Application.Bases.Models;
using Application.Policies;
using Domain.Policies;

namespace Application.Services;

public interface IPolicyService : IService<Policy>
{
    Task<PolicyAuditSnapshot?> GetAuditSnapshotAsync(Guid id);

    Task DeleteAsync(Guid id);

    Task<Policy> GetAsync(Guid organizationId, string key);

    Task<PagedResult<Policy>> GetListAsync(Guid organizationId, PolicyFilter filter);

    Task<PagedResult<PolicyGroup>> GetGroupsAsync(Guid organizationId, Guid policyId, PolicyGroupFilter filter);

    Task<PagedResult<PolicyMember>> GetMembersAsync(Guid organizationId, Guid policyId, PolicyMemberFilter filter);

    Task<bool> IsKeyUsedAsync(Guid organizationId, string key);
}
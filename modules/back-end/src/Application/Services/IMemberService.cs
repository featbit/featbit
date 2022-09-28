using Application.Bases.Models;
using Application.Members;
using Domain.Members;
using Domain.Policies;

namespace Application.Services;

public interface IMemberService
{
    Task<Member> GetAsync(Guid organizationId, Guid memberId);

    Task<PagedResult<Member>> GetListAsync(Guid organizationId, MemberFilter filter);

    Task<List<MemberGroup>> GetGroupsAsync(Guid organizationId, IEnumerable<Guid> memberIds);
    
    Task<PagedResult<MemberGroup>> GetGroupsAsync(Guid organizationId, Guid memberId, MemberGroupFilter filter);

    Task<IEnumerable<Policy>> GetPoliciesAsync(Guid organizationId, Guid memberId);
    
    Task<PagedResult<MemberPolicyVm>> GetDirectPoliciesAsync(Guid organizationId, Guid memberId, MemberPolicyFilter filter);
    
    Task<PagedResult<InheritedMemberPolicy>> GetInheritedPoliciesAsync(Guid organizationId, Guid memberId, InheritedMemberPolicyFilter filter);
}
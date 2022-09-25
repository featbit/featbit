using Application.Bases.Models;
using Application.Members;
using Domain.Members;
using Domain.Policies;

namespace Application.Services;

public interface IMemberService
{
    Task<Member> GetAsync(string organizationId, string memberId);

    Task<PagedResult<Member>> GetListAsync(string organizationId, MemberFilter filter);

    Task<List<MemberGroup>> GetGroupsAsync(string organizationId, IEnumerable<string> memberIds);
    
    Task<PagedResult<MemberGroup>> GetGroupsAsync(string organizationId, string memberId, MemberGroupFilter filter);

    Task<IEnumerable<Policy>> GetPoliciesAsync(string organizationId, string memberId);
}
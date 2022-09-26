using Application.Bases.Models;
using Application.Members;
using Application.Policies;

namespace Api.Controllers;

[Route("api/v{version:apiVersion}/organizations/{organizationId}/members")]
public class MemberController : ApiControllerBase
{
    [HttpGet("{memberId}")]
    public async Task<ApiResponse<MemberVm>> GetAsync(string organizationId, string memberId)
    {
        var request = new GetMember
        {
            OrganizationId = organizationId,
            MemberId = memberId
        };

        var member = await Mediator.Send(request);
        return Ok(member);
    }

    [HttpGet]
    public async Task<ApiResponse<PagedResult<MemberVm>>> GetListAsync(
        string organizationId,
        [FromQuery] MemberFilter filter)
    {
        var request = new GetMemberList
        {
            CurrentUserId = CurrentUser.Id,
            OrganizationId = organizationId,
            Filter = filter
        };

        var members = await Mediator.Send(request);
        return Ok(members);
    }

    [HttpGet("{memberId}/groups")]
    public async Task<ApiResponse<PagedResult<MemberGroupVm>>> GetGroupsAsync(
        string organizationId,
        string memberId,
        [FromQuery] MemberGroupFilter filter)
    {
        var request = new GetMemberGroup
        {
            OrganizationId = organizationId,
            MemberId = memberId,
            Filter = filter
        };

        var groups = await Mediator.Send(request);
        return Ok(groups);
    }

    [HttpGet("{memberId}/policies")]
    public async Task<ApiResponse<IEnumerable<PolicyVm>>> GetPoliciesAsync(string organizationId, string memberId)
    {
        var request = new GetMemberPolicy
        {
            OrganizationId = organizationId,
            MemberId = memberId
        };

        var vms = await Mediator.Send(request);
        return Ok(vms);
    }

    [HttpGet("{memberId}/direct-policies")]
    public async Task<ApiResponse<PagedResult<MemberPolicyVm>>> GetDirectPoliciesAsync(
        string organizationId,
        string memberId,
        [FromQuery] MemberPolicyFilter filter)
    {
        var request = new GetDirectPolicies
        {
            OrganizationId = organizationId,
            MemberId = memberId,
            Filter = filter
        };

        var policies = await Mediator.Send(request);
        return Ok(policies);
    }

    [HttpGet("{memberId}/inherited-policies")]
    public async Task<ApiResponse<PagedResult<InheritedMemberPolicy>>> GetInheritedPoliciesAsync(
        string organizationId,
        string memberId,
        [FromQuery] InheritedMemberPolicyFilter filter)
    {
        var request = new GetInheritedPolicies
        {
            OrganizationId = organizationId,
            MemberId = memberId,
            Filter = filter
        };

        var policies = await Mediator.Send(request);
        return Ok(policies);
    }
}
using Application.Bases.Models;
using Application.Members;
using Application.Policies;

namespace Api.Controllers;

[Route("api/v{version:apiVersion}/organizations/{organizationId:guid}/members")]
public class MemberController : ApiControllerBase
{
    [HttpGet("{memberId:guid}")]
    public async Task<ApiResponse<MemberVm>> GetAsync(Guid organizationId, Guid memberId)
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
        Guid organizationId,
        [FromQuery] MemberFilter filter)
    {
        var request = new GetMemberList
        {
            OrganizationId = organizationId,
            Filter = filter
        };

        var members = await Mediator.Send(request);
        return Ok(members);
    }

    [HttpGet("{memberId:guid}/groups")]
    public async Task<ApiResponse<PagedResult<MemberGroupVm>>> GetGroupsAsync(
        Guid organizationId,
        Guid memberId,
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

    [HttpGet("{memberId:guid}/policies")]
    public async Task<ApiResponse<IEnumerable<PolicyVm>>> GetPoliciesAsync(Guid organizationId, Guid memberId)
    {
        var request = new GetMemberPolicy
        {
            OrganizationId = organizationId,
            MemberId = memberId
        };

        var vms = await Mediator.Send(request);
        return Ok(vms);
    }

    [HttpGet("{memberId:guid}/direct-policies")]
    public async Task<ApiResponse<PagedResult<MemberPolicyVm>>> GetDirectPoliciesAsync(
        Guid organizationId,
        Guid memberId,
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

    [HttpGet("{memberId:guid}/inherited-policies")]
    public async Task<ApiResponse<PagedResult<InheritedMemberPolicy>>> GetInheritedPoliciesAsync(
        Guid organizationId,
        Guid memberId,
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
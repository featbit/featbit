using Application.Bases.Models;
using Application.Members;
using Application.Policies;

namespace Api.Controllers;

[Route("api/v{version:apiVersion}/members")]
public class MemberController : ApiControllerBase
{
    [HttpGet("{memberId:guid}")]
    public async Task<ApiResponse<MemberVm>> GetAsync(Guid memberId)
    {
        var request = new GetMember
        {
            OrganizationId = OrgId,
            MemberId = memberId
        };

        var member = await Mediator.Send(request);
        return Ok(member);
    }

    [HttpDelete("{memberId:guid}")]
    public async Task<ApiResponse<bool>> DeleteAsync(Guid memberId)
    {
        var request = new DeleteMember
        {
            OrganizationId = OrgId,
            MemberId = memberId
        };

        var success = await Mediator.Send(request);
        return Ok(success);
    }

    [HttpGet]
    public async Task<ApiResponse<PagedResult<MemberVm>>> GetListAsync([FromQuery] MemberFilter filter)
    {
        var request = new GetMemberList
        {
            OrganizationId = OrgId,
            Filter = filter
        };

        var members = await Mediator.Send(request);
        return Ok(members);
    }

    [HttpGet("{memberId:guid}/groups")]
    public async Task<ApiResponse<PagedResult<MemberGroupVm>>> GetGroupsAsync(
        Guid memberId,
        [FromQuery] MemberGroupFilter filter)
    {
        var request = new GetMemberGroup
        {
            OrganizationId = OrgId,
            MemberId = memberId,
            Filter = filter
        };

        var groups = await Mediator.Send(request);
        return Ok(groups);
    }

    [HttpGet("{memberId:guid}/policies")]
    public async Task<ApiResponse<IEnumerable<PolicyVm>>> GetPoliciesAsync(Guid memberId)
    {
        var request = new GetMemberPolicy
        {
            OrganizationId = OrgId,
            MemberId = memberId
        };

        var vms = await Mediator.Send(request);
        return Ok(vms);
    }

    [HttpGet("{memberId:guid}/direct-policies")]
    public async Task<ApiResponse<PagedResult<MemberPolicyVm>>> GetDirectPoliciesAsync(
        Guid memberId,
        [FromQuery] MemberPolicyFilter filter)
    {
        var request = new GetDirectPolicies
        {
            OrganizationId = OrgId,
            MemberId = memberId,
            Filter = filter
        };

        var policies = await Mediator.Send(request);
        return Ok(policies);
    }

    [HttpGet("{memberId:guid}/inherited-policies")]
    public async Task<ApiResponse<PagedResult<InheritedMemberPolicy>>> GetInheritedPoliciesAsync(
        Guid memberId,
        [FromQuery] InheritedMemberPolicyFilter filter)
    {
        var request = new GetInheritedPolicies
        {
            OrganizationId = OrgId,
            MemberId = memberId,
            Filter = filter
        };

        var policies = await Mediator.Send(request);
        return Ok(policies);
    }

    [HttpPut("{memberId:guid}/add-policy/{policyId:guid}")]
    public async Task<ApiResponse<bool>> AddPolicyAsync(Guid memberId, Guid policyId)
    {
        var request = new AddMemberPolicy
        {
            OrganizationId = OrgId,
            MemberId = memberId,
            PolicyId = policyId
        };

        var success = await Mediator.Send(request);
        return Ok(success);
    }

    [HttpPut("{memberId:guid}/remove-policy/{policyId:guid}")]
    public async Task<ApiResponse<bool>> RemovePolicyAsync(Guid memberId, Guid policyId)
    {
        var request = new RemoveMemberPolicy
        {
            OrganizationId = OrgId,
            MemberId = memberId,
            PolicyId = policyId
        };

        var success = await Mediator.Send(request);
        return Ok(success);
    }
}
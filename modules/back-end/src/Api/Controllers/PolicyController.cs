using Application.Bases.Models;
using Application.Policies;
using Domain.Policies;

namespace Api.Controllers;

[Route("api/v{version:apiVersion}/policies")]
public class PolicyController : ApiControllerBase
{
    [HttpGet("{id:guid}")]
    public async Task<ApiResponse<PolicyVm>> GetAsync(Guid id)
    {
        var request = new GetPolicy
        {
            Id = id
        };

        var policy = await Mediator.Send(request);
        return Ok(policy);
    }

    [HttpGet]
    public async Task<ApiResponse<PagedResult<PolicyVm>>> GetListAsync([FromQuery] PolicyFilter filter)
    {
        var request = new GetPolicyList
        {
            OrganizationId = OrgId,
            Filter = filter
        };

        var policies = await Mediator.Send(request);
        return Ok(policies);
    }

    [HttpGet("is-name-used")]
    public async Task<ApiResponse<bool>> IsNameUsedAsync(string name)
    {
        var request = new IsPolicyNameUsed
        {
            OrganizationId = OrgId,
            Name = name
        };

        var isNameUsed = await Mediator.Send(request);
        return Ok(isNameUsed);
    }

    [HttpPost]
    public async Task<ApiResponse<PolicyVm>> CreateAsync(CreatePolicy request)
    {
        request.OrganizationId = OrgId;

        var policy = await Mediator.Send(request);
        return Ok(policy);
    }

    [HttpPut("{policyId:guid}/settings")]
    public async Task<ApiResponse<PolicyVm>> UpdateSettingAsync(Guid policyId, UpdatePolicySetting request)
    {
        request.PolicyId = policyId;

        var policy = await Mediator.Send(request);
        return Ok(policy);
    }

    [HttpPut("{policyId:guid}/statements")]
    public async Task<ApiResponse<PolicyVm>> UpdateStatementsAsync(Guid policyId, ICollection<PolicyStatement> statements)
    {
        var request = new UpdatePolicyStatements
        {
            PolicyId = policyId,
            Statements = statements
        };

        var policy = await Mediator.Send(request);
        return Ok(policy);
    }

    [HttpDelete("{policyId:guid}")]
    public async Task<ApiResponse<bool>> DeleteAsync(Guid policyId)
    {
        var request = new DeletePolicy
        {
            PolicyId = policyId
        };

        var success = await Mediator.Send(request);
        return Ok(success);
    }

    [HttpGet("{policyId:guid}/groups")]
    public async Task<ApiResponse<PagedResult<PolicyGroup>>> GetGroupsAsync(
        Guid policyId,
        [FromQuery] PolicyGroupFilter filter)
    {
        var request = new GetPolicyGroup
        {
            OrganizationId = OrgId,
            PolicyId = policyId,
            Filter = filter
        };

        var groups = await Mediator.Send(request);
        return Ok(groups);
    }

    [HttpGet("{policyId:guid}/members")]
    public async Task<ApiResponse<PagedResult<PolicyMember>>> GetMembersAsync(
        Guid policyId,
        [FromQuery] PolicyMemberFilter filter)
    {
        var request = new GetPolicyMember
        {
            OrganizationId = OrgId,
            PolicyId = policyId,
            Filter = filter
        };

        var members = await Mediator.Send(request);
        return Ok(members);
    }
}
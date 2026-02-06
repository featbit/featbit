using Api.Authentication;
using Api.Authorization;
using Application.Bases.Models;
using Application.Policies;
using Domain.Policies;

namespace Api.Controllers;

[Route("api/v{version:apiVersion}/policies")]
[Authorize(Permissions.CanManageIAM)]
public class PolicyController : ApiControllerBase
{
    /// <summary>
    /// Get a policy
    /// </summary>
    /// <remarks>
    /// Get a single policy by ID.
    /// </remarks>
    [OpenApi]
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

    /// <summary>
    /// Get policy list of current organization
    /// </summary>
    /// <remarks>
    /// Get the list of all policies within the current organization.
    /// </remarks>
    [OpenApi]
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
    
    /// <summary>
    /// Check if a key is available for creating a new policy
    /// </summary>
    /// <remarks>
    /// Check if a key is available for creating a new policy.
    /// </remarks>
    [HttpGet("is-key-used")]
    public async Task<ApiResponse<bool>> IsKeyUsedAsync(string key)
    {
        var request = new IsPolicyKeyUsed
        {
            OrganizationId = OrgId,
            Key = key
        };

        var isUsed = await Mediator.Send(request);
        return Ok(isUsed);
    }

    /// <summary>
    /// Create a policy
    /// </summary>
    /// <remarks>
    /// Create a new policy with the given name, key and description.
    /// </remarks>
    [OpenApi]
    [HttpPost]
    public async Task<ApiResponse<PolicyVm>> CreateAsync(CreatePolicy request)
    {
        request.OrganizationId = OrgId;

        var policy = await Mediator.Send(request);
        return Ok(policy);
    }

    /// <summary>
    /// Clone a policy
    /// </summary>
    /// <remarks>
    /// Clone a policy.
    /// </remarks>
    [OpenApi]
    [HttpPost("clone/{key}")]
    public async Task<ApiResponse<PolicyVm>> CloneAsync(string key, ClonePolicy request)
    {
        request.OrgId = OrgId;
        request.OriginPolicyKey = key;

        var policy = await Mediator.Send(request);
        return Ok(policy);
    }

    /// <summary>
    /// Update a policy
    /// </summary>
    /// <remarks>
    /// Update the name and description of a policy.
    /// </remarks>
    [OpenApi]
    [HttpPut("{policyId:guid}/settings")]
    public async Task<ApiResponse<PolicyVm>> UpdateSettingAsync(Guid policyId, UpdatePolicySetting request)
    {
        request.PolicyId = policyId;

        var policy = await Mediator.Send(request);
        return Ok(policy);
    }

    /// <summary>
    /// Set the statements of a policy
    /// </summary>
    /// <remarks>
    /// Set the statements of a policy.
    /// </remarks>
    [OpenApi]
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

    /// <summary>
    /// Delete a policy
    /// </summary>
    /// <remarks>
    /// Permanently delete a policy and all its associated data. This action cannot be undone.
    /// </remarks>
    [OpenApi]
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

    /// <summary>
    /// Get all groups which contain the policy
    /// </summary>
    /// <remarks>
    /// Get the list of all groups which contain the policy within the current organization.
    /// </remarks>
    [OpenApi]
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

    /// <summary>
    /// Get all member users to which the policy is assigned
    /// </summary>
    /// <remarks>
    /// Get the list of all member users to which the policy is assigned within the current organization.
    /// </remarks>
    [OpenApi]
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
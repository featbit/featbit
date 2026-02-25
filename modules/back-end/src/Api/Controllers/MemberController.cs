using Api.Authentication;
using Api.Authorization;
using Application.Bases.Models;
using Application.Members;
using Application.Policies;

namespace Api.Controllers;

[Route("api/v{version:apiVersion}/members")]
[Authorize(Permissions.CanManageIAM)]
public class MemberController : ApiControllerBase
{
    /// <summary>
    /// Get a member user
    /// </summary>
    /// <remarks>
    /// Get a single member user by ID.
    /// </remarks>
    [OpenApi]
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

    /// <summary>
    /// Remove a member user from organization
    /// </summary>
    /// <remarks>
    /// Remove a member user from the current organization.
    /// </remarks>
    [OpenApi]
    [HttpDelete("remove-from-org/{memberId:guid}")]
    public async Task<ApiResponse<bool>> RemoveFromOrganizationAsync(Guid memberId)
    {
        var request = new RemoveFromOrganization
        {
            OrganizationId = OrgId,
            MemberId = memberId
        };

        var success = await Mediator.Send(request);
        return Ok(success);
    }

    /// <summary>
    /// Remove a member user from the workspace
    /// </summary>
    /// <remarks>
    /// Remove a member user from the workspace.
    /// </remarks>
    [OpenApi]
    [HttpDelete("remove-from-workspace/{memberId:guid}")]
    public async Task<ApiResponse<bool>> RemoveFromWorkspaceAsync(Guid memberId)
    {
        var request = new RemoveFromWorkspace
        {
            WorkspaceId = WorkspaceId,
            MemberId = memberId
        };

        var success = await Mediator.Send(request);
        return Ok(success);
    }

    /// <summary>
    /// Get member user list of current organization
    /// </summary>
    /// <remarks>
    /// Get the list of all member users within the current organization.
    /// </remarks>
    [OpenApi]
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

    /// <summary>
    /// Get all groups of the member user
    /// </summary>
    /// <remarks>
    /// Get the list of all groups of the member user within the current organization.
    /// </remarks>
    [OpenApi]
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

    /// <summary>
    /// Get all policies of the member user
    /// </summary>
    /// <remarks>
    /// Get the list of all direct and inherited policies of the member user within the current organization.
    /// </remarks>
    [OpenApi]
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

    /// <summary>
    /// Get all direct policies of the member user
    /// </summary>
    /// <remarks>
    /// Get the list of all direct policies of the member user within the current organization.
    /// </remarks>
    [OpenApi]
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

    /// <summary>
    /// Get all inherited policies of the member user
    /// </summary>
    /// <remarks>
    /// Get the list of all inherited policies of the member user within the current organization.
    /// </remarks>
    [OpenApi]
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

    /// <summary>
    /// Add a policy to a member user
    /// </summary>
    /// <remarks>
    /// Add a policy to a member user.
    /// </remarks>
    [OpenApi]
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

    /// <summary>
    /// Remove a policy from a member user
    /// </summary>
    /// <remarks>
    /// Remove a policy from a member user.
    /// </remarks>
    [OpenApi]
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
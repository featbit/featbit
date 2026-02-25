using Api.Authentication;
using Api.Authorization;
using Application.Bases.Models;
using Application.Groups;

namespace Api.Controllers;

[Route("api/v{version:apiVersion}/groups")]
[Authorize(Permissions.CanManageIAM)]
public class GroupController : ApiControllerBase
{
    /// <summary>
    /// Get a group
    /// </summary>
    /// <remarks>
    /// Get a single group by ID.
    /// </remarks>
    [OpenApi]
    [HttpGet("{id:guid}")]
    public async Task<ApiResponse<GroupVm>> GetAsync(Guid id)
    {
        var request = new GetGroup
        {
            Id = id
        };

        var group = await Mediator.Send(request);
        return Ok(group);
    }

    /// <summary>
    /// Get list of groups within the current organization
    /// </summary>
    /// <remarks>
    /// Get the list of all groups within the current organization.
    /// </remarks>
    [OpenApi]
    [HttpGet]
    public async Task<ApiResponse<PagedResult<GroupVm>>> GetListAsync([FromQuery] GroupFilter filter)
    {
        var request = new GetGroupList
        {
            OrganizationId = OrgId,
            Filter = filter
        };

        var groups = await Mediator.Send(request);
        return Ok(groups);
    }

    /// <summary>
    /// Check if a name is available for creating a new group
    /// </summary>
    [HttpGet("is-name-used")]
    public async Task<ApiResponse<bool>> IsNameUsedAsync(string name)
    {
        var request = new IsGroupNameUsed
        {
            OrganizationId = OrgId,
            Name = name
        };

        var result = await Mediator.Send(request);
        return Ok(result);
    }

    /// <summary>
    /// Create a group
    /// </summary>
    /// <remarks>
    /// Create a new group with the given name and description.
    /// </remarks>
    [OpenApi]
    [HttpPost]
    public async Task<ApiResponse<GroupVm>> CreateAsync(CreateGroup request)
    {
        request.OrganizationId = OrgId;

        var group = await Mediator.Send(request);
        return Ok(group);
    }

    /// <summary>
    /// Update a group
    /// </summary>
    /// <remarks>
    /// Update the name and description of a group.
    /// </remarks>
    [OpenApi]
    [HttpPut("{id:guid}")]
    public async Task<ApiResponse<GroupVm>> UpdateAsync(Guid id, UpdateGroup request)
    {
        request.Id = id;

        var group = await Mediator.Send(request);
        return Ok(group);
    }

    /// <summary>
    /// Delete a group
    /// </summary>
    /// <remarks>
    /// Permanently delete a group and all its associated data. This action cannot be undone.
    /// </remarks>
    [OpenApi]
    [HttpDelete("{id:guid}")]
    public async Task<ApiResponse<bool>> DeleteAsync(Guid id)
    {
        var request = new DeleteGroup
        {
            Id = id
        };

        var success = await Mediator.Send(request);
        return Ok(success);
    }

    /// <summary>
    /// Get member users that the group contains
    /// </summary>
    /// <remarks>
    /// Get the list of member users that the group contains within the current organization.
    /// </remarks>
    [OpenApi]
    [HttpGet("{groupId:guid}/members")]
    public async Task<ApiResponse<PagedResult<GroupMemberVm>>> GetMembersAsync(
        Guid groupId,
        [FromQuery] GroupMemberFilter filter)
    {
        var request = new GetGroupMember
        {
            OrganizationId = OrgId,
            GroupId = groupId,
            Filter = filter
        };

        var groupMembers = await Mediator.Send(request);
        return Ok(groupMembers);
    }

    /// <summary>
    /// Add a member user to a group
    /// </summary>
    /// <remarks>
    /// Add a member user to a group.
    /// </remarks>
    [OpenApi]
    [HttpPut("{groupId:guid}/add-member/{memberId:guid}")]
    public async Task<ApiResponse<bool>> AddMemberAsync(Guid groupId, Guid memberId)
    {
        var request = new AddGroupMember
        {
            OrganizationId = OrgId,
            GroupId = groupId,
            MemberId = memberId
        };

        var success = await Mediator.Send(request);
        return Ok(success);
    }

    /// <summary>
    /// Remove a member user from a group
    /// </summary>
    /// <remarks>
    /// Remove a member user from a group.
    /// </remarks>
    [OpenApi]
    [HttpPut("{groupId:guid}/remove-member/{memberId:guid}")]
    public async Task<ApiResponse<bool>> RemoveMemberAsync(Guid groupId, Guid memberId)
    {
        var request = new RemoveGroupMember
        {
            GroupId = groupId,
            MemberId = memberId
        };

        var success = await Mediator.Send(request);
        return Ok(success);
    }

    /// <summary>
    /// Get all policies assigned to a group
    /// </summary>
    /// <remarks>
    /// Get the list of all policies which are assigned to the group within the current organization.
    /// </remarks>
    [OpenApi]
    [HttpGet("{groupId:guid}/policies")]
    public async Task<ApiResponse<PagedResult<GroupPolicyVm>>> GetPoliciesAsync(
        Guid groupId,
        [FromQuery] GroupPolicyFilter filter)
    {
        var request = new GetGroupPolicy
        {
            OrganizationId = OrgId,
            GroupId = groupId,
            Filter = filter
        };

        var policies = await Mediator.Send(request);
        return Ok(policies);
    }

    /// <summary>
    /// Assign a policy to a group
    /// </summary>
    /// <remarks>
    /// Assign a policy to a group.
    /// </remarks>
    [OpenApi]
    [HttpPut("{groupId:guid}/add-policy/{policyId:guid}")]
    public async Task<ApiResponse<bool>> AddPolicyAsync(Guid groupId, Guid policyId)
    {
        var request = new AddGroupPolicy
        {
            GroupId = groupId,
            PolicyId = policyId
        };

        var success = await Mediator.Send(request);
        return Ok(success);
    }

    /// <summary>
    /// Remove a policy from a group
    /// </summary>
    /// <remarks>
    /// Remove a policy from group.
    /// </remarks>
    [OpenApi]
    [HttpPut("{groupId:guid}/remove-policy/{policyId:guid}")]
    public async Task<ApiResponse<bool>> RemovePolicyAsync(Guid groupId, Guid policyId)
    {
        var request = new RemoveGroupPolicy
        {
            GroupId = groupId,
            PolicyId = policyId
        };

        var success = await Mediator.Send(request);
        return Ok(success);
    }
}
using Application.Bases.Models;
using Application.Groups;

namespace Api.Controllers;

[Route("api/v{version:apiVersion}/groups")]
public class GroupController : ApiControllerBase
{
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

    [HttpPost]
    public async Task<ApiResponse<GroupVm>> CreateAsync(CreateGroup request)
    {
        request.OrganizationId = OrgId;

        var group = await Mediator.Send(request);
        return Ok(group);
    }

    [HttpPut("{id:guid}")]
    public async Task<ApiResponse<GroupVm>> UpdateAsync(Guid id, UpdateGroup request)
    {
        request.Id = id;

        var group = await Mediator.Send(request);
        return Ok(group);
    }

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
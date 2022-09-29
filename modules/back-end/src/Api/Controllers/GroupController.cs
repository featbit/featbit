using Application.Bases.Models;
using Application.Groups;

namespace Api.Controllers;

[Route("api/v{version:apiVersion}/organizations/{organizationId:guid}/groups")]
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
    public async Task<ApiResponse<PagedResult<GroupVm>>> GetListAsync(Guid organizationId, [FromQuery] GroupFilter filter)
    {
        var request = new GetGroupList
        {
            OrganizationId = organizationId,
            Filter = filter
        };
        
        var groups = await Mediator.Send(request);
        return Ok(groups);
    }
    
    [HttpGet("is-name-used")]
    public async Task<ApiResponse<bool>> IsNameUsedAsync(Guid organizationId, string name)
    {
        var request = new IsGroupNameUsed
        {
            OrganizationId = organizationId,
            Name = name
        };

        var result = await Mediator.Send(request);
        return Ok(result);
    }
    
    [HttpGet("{groupId:guid}/members")]
    public async Task<ApiResponse<PagedResult<GroupMemberVm>>> GetMembersAsync(
        Guid organizationId, 
        Guid groupId, 
        [FromQuery] GroupMemberFilter filter)
    {
        var request = new GetGroupMember
        {
            OrganizationId = organizationId,
            GroupId = groupId,
            Filter = filter
        };

        var groupMembers = await Mediator.Send(request);
        return Ok(groupMembers);
    }
    
    [HttpGet("{groupId:guid}/policies")]
    public async Task<ApiResponse<PagedResult<GroupPolicyVm>>> GetPoliciesAsync(
        Guid organizationId, 
        Guid groupId, 
        [FromQuery] GroupPolicyFilter filter)
    {
        var request = new GetGroupPolicy
        {
            OrganizationId = organizationId,
            GroupId = groupId,
            Filter = filter
        };

        var policies = await Mediator.Send(request);
        return Ok(policies);
    }
}
using Application.Bases.Models;
using Application.Groups;

namespace Api.Controllers;

[Route("api/v{version:apiVersion}/organizations/{organizationId}/groups")]
public class GroupController : ApiControllerBase
{
    [HttpGet("{id}")]
    public async Task<ApiResponse<GroupVm>> GetAsync(string id)
    {
        var request = new GetGroup
        {
            Id = id
        };

        var group = await Mediator.Send(request);
        return Ok(group);
    }
    
    [HttpGet]
    public async Task<ApiResponse<PagedResult<GroupVm>>> GetListAsync(string organizationId, [FromQuery] GroupFilter filter)
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
    public async Task<ApiResponse<bool>> IsNameUsedAsync(string organizationId, string name)
    {
        var request = new IsNameUsed
        {
            OrganizationId = organizationId,
            Name = name
        };

        var result = await Mediator.Send(request);
        return Ok(result);
    }
    
    [HttpGet("{groupId}/members")]
    public async Task<ApiResponse<PagedResult<GroupMemberVm>>> GetMembersAsync(
        string organizationId, 
        string groupId, 
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
    
    [HttpGet("{groupId}/policies")]
    public async Task<ApiResponse<PagedResult<GroupPolicyVm>>> GetPoliciesAsync(
        string organizationId, 
        string groupId, 
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
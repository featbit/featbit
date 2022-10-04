using Application.Bases.Models;
using Application.EndUsers;
using Domain.EndUsers;

namespace Api.Controllers;

[Route("api/v{version:apiVersion}/envs/{envId:guid}/end-users")]
public class EndUserController : ApiControllerBase
{
    [HttpGet("{id:guid}")]
    public async Task<ApiResponse<EndUser>> GetAsync(Guid id)
    {
        var request = new GetEndUser
        {
            Id = id
        };

        var user = await Mediator.Send(request);
        return Ok(user);
    }

    [HttpGet]
    public async Task<ApiResponse<PagedResult<EndUser>>> GetListAsync(Guid envId)
    {
        var filter = new EndUserFilter(Request.Query);

        var request = new GetEndUserList
        {
            EnvId = envId,
            Filter = filter
        };

        var users = await Mediator.Send(request);
        return Ok(users);
    }

    [HttpPut]
    public async Task<ApiResponse<EndUser>> UpsertAsync(Guid envId, UpsertEndUser request)
    {
        request.EnvId = envId;

        var user = await Mediator.Send(request);
        return Ok(user);
    }

    [HttpGet("by-keyIds")]
    public async Task<ApiResponse<IEnumerable<EndUser>>> GetByKeyIdsAsync(Guid envId, [FromQuery] string[] keyIds)
    {
        var request = new GetEndUserByKeyIds
        {
            EnvId = envId,
            KeyIds = keyIds
        };

        var users = await Mediator.Send(request);
        return Ok(users);
    }
}
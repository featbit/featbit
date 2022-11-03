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

    [HttpGet("{id:guid}/flags")]
    public async Task<ApiResponse<List<EndUserFlag>>> GetFlagsAsync(Guid id)
    {
        var variations = new List<EndUserFlag>
        {
            new()
            {
                Name = "flag name",
                Key = "my-flag",
                VariationType = "string",
                Variation = "true",
                VariationDisplayOrder = 1,
                MatchReason = "targeted"
            }
        };

        return Ok(variations);
    }

    [HttpGet("{id:guid}/segments")]
    public async Task<ApiResponse<List<EndUserSegment>>> GetSegmentsAsync(Guid id)
    {
        var segments = new List<EndUserSegment>
        {
            new()
            {
                Id = "ee4e01dc-b908-402d-a6d4-af42006d1bac",
                Name = "tester",
                UpdatedAt = new DateTime(2022, 11, 3)
            }
        };

        return Ok(segments);
    }
}
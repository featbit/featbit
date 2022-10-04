using Application.EndUsers;
using Domain.EndUsers;

namespace Api.Controllers;

[Route("api/v{version:apiVersion}/envs/{envId:guid}/end-user-properties")]
public class EndUserPropertyController : ApiControllerBase
{
    [HttpGet]
    public async Task<ApiResponse<IEnumerable<EndUserProperty>>> GetListAsync(Guid envId)
    {
        var request = new GetEndUserProperties
        {
            EnvId = envId
        };

        var properties = await Mediator.Send(request);
        return Ok(properties);
    }

    [HttpPut("{propertyId:guid}/upsert")]
    public async Task<ApiResponse<EndUserProperty>> UpsertAsync(Guid envId, Guid propertyId, UpsertEndUserProperty request)
    {
        request.EnvId = envId;
        request.PropertyId = propertyId;

        var property = await Mediator.Send(request);
        return Ok(property);
    }

    [HttpDelete("{id:guid}")]
    public async Task<ApiResponse<bool>> DeleteAsync(Guid id)
    {
        var request = new DeleteEndUserProperty
        {
            Id = id
        };

        var success = await Mediator.Send(request);
        return Ok(success);
    }
}
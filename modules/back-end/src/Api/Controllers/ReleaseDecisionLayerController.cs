using Application.Bases.Models;
using Application.ReleaseDecisions;
using Api.Authentication;
using Domain.Policies;

namespace Api.Controllers;

[Authorize(Permissions.CanAccessEnv)]
[Route("api/v{version:apiVersion}/envs/{envId:guid}/release-decision/layers")]
public class ReleaseDecisionLayerController : ApiControllerBase
{
    [OpenApi]
    [HttpGet]
    public async Task<ApiResponse<PagedResult<ReleaseDecisionLayerVm>>> GetListAsync(
        Guid envId,
        [FromQuery] ReleaseDecisionLayerFilter filter)
    {
        var layers = await Mediator.Send(new QueryReleaseDecisionLayers
        {
            EnvId = envId,
            Filter = filter
        });

        return Ok(layers);
    }

    [OpenApi]
    [HttpPost]
    public async Task<ApiResponse<ReleaseDecisionLayerVm>> CreateAsync(
        Guid envId,
        ReleaseDecisionLayerUpdate update)
    {
        var layer = await Mediator.Send(new CreateReleaseDecisionLayer
        {
            EnvId = envId,
            Update = update
        });

        return Ok(layer);
    }

    [OpenApi]
    [HttpPut("{id:guid}")]
    public async Task<ApiResponse<ReleaseDecisionLayerVm>> UpdateAsync(
        Guid envId,
        Guid id,
        ReleaseDecisionLayerUpdate update)
    {
        var layer = await Mediator.Send(new UpdateReleaseDecisionLayer
        {
            EnvId = envId,
            Id = id,
            Update = update
        });

        return Ok(layer);
    }

    [OpenApi]
    [HttpDelete("{id:guid}")]
    public async Task<ApiResponse<bool>> DeleteAsync(Guid envId, Guid id)
    {
        await Mediator.Send(new DeleteReleaseDecisionLayer
        {
            EnvId = envId,
            Id = id
        });

        return Ok(true);
    }
}

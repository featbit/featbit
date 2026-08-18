using Application.Bases.Models;
using Application.Experiments;
using Api.Authentication;
using Domain.Policies;

namespace Api.Controllers;

[Authorize(Permissions.CanAccessEnv)]
[Route("api/v{version:apiVersion}/envs/{envId:guid}/experiment-layers")]
public class ExperimentLayerController : ApiControllerBase
{
    [OpenApi]
    [HttpGet]
    public async Task<ApiResponse<PagedResult<ExperimentLayerVm>>> GetListAsync(
        Guid envId,
        [FromQuery] ExperimentLayerFilter filter)
    {
        var layers = await Mediator.Send(new QueryExperimentLayers
        {
            EnvId = envId,
            Filter = filter
        });

        return Ok(layers);
    }

    [OpenApi]
    [HttpPost]
    public async Task<ApiResponse<ExperimentLayerVm>> CreateAsync(
        Guid envId,
        ExperimentLayerUpdate update)
    {
        var layer = await Mediator.Send(new CreateExperimentLayer
        {
            EnvId = envId,
            Update = update
        });

        return Ok(layer);
    }

    [OpenApi]
    [HttpPut("{id:guid}")]
    public async Task<ApiResponse<ExperimentLayerVm>> UpdateAsync(
        Guid envId,
        Guid id,
        ExperimentLayerUpdate update)
    {
        var layer = await Mediator.Send(new UpdateExperimentLayer
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
        await Mediator.Send(new DeleteExperimentLayer
        {
            EnvId = envId,
            Id = id
        });

        return Ok(true);
    }
}

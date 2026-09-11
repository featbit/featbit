using Application.Bases.Models;
using Application.Experiments.ExperimentLayers;
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
        var layers = await Mediator.Send(new GetExperimentLayerList
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
        CreateExperimentLayerRequest request)
    {
        var layer = await Mediator.Send(new CreateExperimentLayer
        {
            EnvId = envId,
            Request = request
        });

        return Ok(layer);
    }

    [OpenApi]
    [HttpPut("{id:guid}")]
    public async Task<ApiResponse<ExperimentLayerVm>> UpdateAsync(
        Guid envId,
        Guid id,
        UpdateExperimentLayerRequest request)
    {
        var layer = await Mediator.Send(new UpdateExperimentLayer
        {
            EnvId = envId,
            Id = id,
            Request = request
        });

        return Ok(layer);
    }

    [OpenApi]
    [HttpPut("{id:guid}/archive")]
    public async Task<ApiResponse<bool>> ArchiveAsync(Guid envId, Guid id)
    {
        await Mediator.Send(new ArchiveExperimentLayer
        {
            EnvId = envId,
            Id = id
        });

        return Ok(true);
    }

    [OpenApi]
    [HttpPut("{id:guid}/restore")]
    public async Task<ApiResponse<bool>> RestoreAsync(Guid envId, Guid id)
    {
        await Mediator.Send(new RestoreExperimentLayer
        {
            EnvId = envId,
            Id = id
        });

        return Ok(true);
    }
}

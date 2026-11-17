using Application.Bases.Models;
using Application.Experiments.ExperimentMetrics;
using Api.Authentication;
using Domain.Policies;

namespace Api.Controllers;

[Authorize(Permissions.CanAccessEnv)]
[Route("api/v{version:apiVersion}/envs/{envId:guid}/experiment-metrics")]
public class ExperimentMetricController : ApiControllerBase
{
    [OpenApi]
    [HttpGet]
    public async Task<ApiResponse<PagedResult<ExperimentMetricVm>>> GetListAsync(
        Guid envId,
        [FromQuery] ExperimentMetricFilter filter)
    {
        var metrics = await Mediator.Send(new GetExperimentMetricList
        {
            EnvId = envId,
            Filter = filter
        });

        return Ok(metrics);
    }

    [OpenApi]
    [HttpPost]
    public async Task<ApiResponse<ExperimentMetricVm>> CreateAsync(
        Guid envId,
        CreateExperimentMetricRequest request)
    {
        var metric = await Mediator.Send(new CreateExperimentMetric
        {
            EnvId = envId,
            Request = request
        });

        return Ok(metric);
    }

    [OpenApi]
    [HttpPut("{id:guid}")]
    public async Task<ApiResponse<ExperimentMetricVm>> UpdateAsync(
        Guid envId,
        Guid id,
        UpdateExperimentMetricRequest request)
    {
        var metric = await Mediator.Send(new UpdateExperimentMetric
        {
            EnvId = envId,
            Id = id,
            Request = request
        });

        return Ok(metric);
    }

    [OpenApi]
    [HttpPut("{id:guid}/archive")]
    public async Task<ApiResponse<bool>> ArchiveAsync(Guid envId, Guid id)
    {
        await Mediator.Send(new ArchiveExperimentMetric
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
        await Mediator.Send(new RestoreExperimentMetric
        {
            EnvId = envId,
            Id = id
        });

        return Ok(true);
    }
}

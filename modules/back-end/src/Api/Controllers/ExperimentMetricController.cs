using Application.Bases.Models;
using Application.Experiments;
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
        var metrics = await Mediator.Send(new QueryExperimentMetrics
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
        ExperimentMetricUpdate update)
    {
        var metric = await Mediator.Send(new CreateExperimentMetric
        {
            EnvId = envId,
            Update = update
        });

        return Ok(metric);
    }

    [OpenApi]
    [HttpPut("{id:guid}")]
    public async Task<ApiResponse<ExperimentMetricVm>> UpdateAsync(
        Guid envId,
        Guid id,
        ExperimentMetricUpdate update)
    {
        var metric = await Mediator.Send(new UpdateExperimentMetric
        {
            EnvId = envId,
            Id = id,
            Update = update
        });

        return Ok(metric);
    }

    [OpenApi]
    [HttpDelete("{id:guid}")]
    public async Task<ApiResponse<bool>> DeleteAsync(Guid envId, Guid id)
    {
        await Mediator.Send(new DeleteExperimentMetric
        {
            EnvId = envId,
            Id = id
        });

        return Ok(true);
    }
}

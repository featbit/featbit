using Application.Bases.Models;
using Application.ExperimentMetrics;

namespace Api.Controllers;

[Route("api/v{version:apiVersion}/envs/{envId:guid}/experiment-metrics")]
public class ExperimentMetricController : ApiControllerBase
{
    [HttpGet]
    public async Task<ApiResponse<PagedResult<ExperimentMetricVm>>> GetListAsync(
        Guid envId,
        [FromQuery] ExperimentMetricFilter filter)
    {
        var request = new GetExperimentMetricList
        {
            EnvId = envId,
            Filter = filter
        };

        var metrics = await Mediator.Send(request);
        return Ok(metrics);
    }


    [HttpPost]
    public async Task<ApiResponse<ExperimentMetricVm>> CreateAsync(Guid envId, CreateExperimentMetric request)
    {
        request.EnvId = envId;
        var metricVm = await Mediator.Send(request);
        return Ok(metricVm);
    }

    [HttpPut("{id:guid}")]
    public async Task<ApiResponse<ExperimentMetricVm>> UpdateAsync(Guid id, UpdateExperimentMetric request)
    {
        request.Id = id;

        var metricVm = await Mediator.Send(request);

        return Ok(metricVm);
    }

    [HttpPut("{id:guid}/archive")]
    public async Task<ApiResponse<bool>> ArchiveAsync(Guid id)
    {
        var request = new ArchiveExperimentMetric
        {
            Id = id
        };

        var success = await Mediator.Send(request);
        return Ok(success);
    }
}
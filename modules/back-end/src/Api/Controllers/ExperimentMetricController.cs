using Application.Bases.Models;
using Application.Experiments;
using Domain.Experiments;

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
    public async Task<ApiResponse<ExperimentMetric>> CreateAsync(Guid envId, CreateExperimentMetric request)
    {
        request.EnvId = envId;
        var em = await Mediator.Send(request);
        return Ok(em);
    }
}
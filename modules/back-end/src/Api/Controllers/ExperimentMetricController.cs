using Application.Bases.Models;
using Application.Experiments;

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
}
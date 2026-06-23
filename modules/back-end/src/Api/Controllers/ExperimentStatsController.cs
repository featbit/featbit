using Api.Authentication;
using Application.ExperimentStats;

namespace Api.Controllers;

[Route("api/v{version:apiVersion}/envs/{envId:guid}/experiment-stats")]
public class ExperimentStatsController : ApiControllerBase
{
    [OpenApi]
    [HttpPost("query")]
    public async Task<ApiResponse<ExperimentStatsVm>> QueryAsync(Guid envId, QueryExperimentStats request)
    {
        request.EnvId = envId;

        var stats = await Mediator.Send(request);
        return Ok(stats);
    }
}

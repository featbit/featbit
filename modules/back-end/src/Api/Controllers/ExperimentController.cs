using Application.Bases.Models;
using Application.Experiments;

namespace Api.Controllers;

[Route("api/v{version:apiVersion}/envs/{envId:guid}/experiments")]
public class ExperimentController : ApiControllerBase
{
    [HttpGet]
    public async Task<ApiResponse<PagedResult<ExperimentVm>>> GetListAsync(
        Guid envId,
        [FromQuery] ExperimentFilter filter)
    {
        var request = new GetExperimentList
        {
            EnvId = envId,
            Filter = filter
        };

        var expts = await Mediator.Send(request);
        return Ok(expts);
    }
}
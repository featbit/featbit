using Application.Bases.Models;
using Application.ReleaseDecisions;
using Api.Authentication;
using Domain.Policies;

namespace Api.Controllers;

[Authorize(Permissions.CanAccessEnv)]
[Route("api/v{version:apiVersion}/envs/{envId:guid}/release-decision/metrics")]
public class ReleaseDecisionMetricController : ApiControllerBase
{
    [OpenApi]
    [HttpGet]
    public async Task<ApiResponse<PagedResult<ReleaseDecisionMetricVm>>> GetListAsync(
        Guid envId,
        [FromQuery] ReleaseDecisionMetricFilter filter)
    {
        var metrics = await Mediator.Send(new QueryReleaseDecisionMetrics
        {
            EnvId = envId,
            Filter = filter
        });

        return Ok(metrics);
    }

    [OpenApi]
    [HttpPost]
    public async Task<ApiResponse<ReleaseDecisionMetricVm>> CreateAsync(
        Guid envId,
        ReleaseDecisionMetricUpdate update)
    {
        var metric = await Mediator.Send(new CreateReleaseDecisionMetric
        {
            EnvId = envId,
            Update = update
        });

        return Ok(metric);
    }

    [OpenApi]
    [HttpPut("{id:guid}")]
    public async Task<ApiResponse<ReleaseDecisionMetricVm>> UpdateAsync(
        Guid envId,
        Guid id,
        ReleaseDecisionMetricUpdate update)
    {
        var metric = await Mediator.Send(new UpdateReleaseDecisionMetric
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
        await Mediator.Send(new DeleteReleaseDecisionMetric
        {
            EnvId = envId,
            Id = id
        });

        return Ok(true);
    }
}

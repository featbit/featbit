using Application.Bases.Models;
using Application.ReleaseDecisions;
using Domain.Policies;

namespace Api.Controllers;

[Authorize(Permissions.CanAccessEnv)]
[Route("api/v{version:apiVersion}/envs/{envId:guid}/release-decision/experiments")]
public class ReleaseDecisionExperimentController : ApiControllerBase
{
    [HttpPost]
    public async Task<ApiResponse<ReleaseDecisionExperimentVm>> CreateAsync(
        Guid envId,
        CreateReleaseDecisionExperiment request)
    {
        request.EnvId = envId;

        var experiment = await Mediator.Send(request);
        return Ok(experiment);
    }

    [HttpGet]
    public async Task<ApiResponse<PagedResult<ReleaseDecisionExperimentVm>>> GetListAsync(
        Guid envId,
        [FromQuery] ReleaseDecisionExperimentFilter filter)
    {
        var request = new QueryReleaseDecisionExperiments
        {
            EnvId = envId,
            Filter = filter
        };

        var experiments = await Mediator.Send(request);
        return Ok(experiments);
    }

    [HttpGet("{id:guid}")]
    public async Task<ApiResponse<ReleaseDecisionExperimentDetailVm>> GetAsync(Guid envId, Guid id)
    {
        var experiment = await Mediator.Send(new GetReleaseDecisionExperiment
        {
            EnvId = envId,
            Id = id
        });

        return Ok(experiment);
    }

    [HttpDelete("{id:guid}")]
    public async Task<ApiResponse<bool>> DeleteAsync(Guid envId, Guid id)
    {
        await Mediator.Send(new DeleteReleaseDecisionExperiment
        {
            EnvId = envId,
            Id = id
        });

        return Ok(true);
    }

    [HttpPut("{id:guid}")]
    public async Task<ApiResponse<ReleaseDecisionExperimentDetailVm>> UpdateAsync(
        Guid envId,
        Guid id,
        ReleaseDecisionExperimentUpdate update)
    {
        var experiment = await Mediator.Send(new UpdateReleaseDecisionExperiment
        {
            EnvId = envId,
            Id = id,
            Update = update
        });

        return Ok(experiment);
    }

    [HttpPut("{id:guid}/stage")]
    public async Task<ApiResponse<ReleaseDecisionExperimentDetailVm>> UpdateStageAsync(
        Guid envId,
        Guid id,
        UpdateReleaseDecisionExperimentStage request)
    {
        request.EnvId = envId;
        request.Id = id;

        var experiment = await Mediator.Send(request);
        return Ok(experiment);
    }

    [HttpPut("{id:guid}/metrics")]
    public async Task<ApiResponse<ReleaseDecisionExperimentDetailVm>> UpdateMetricsAsync(
        Guid envId,
        Guid id,
        ReleaseDecisionMetricsUpdate update)
    {
        var experiment = await Mediator.Send(new UpdateReleaseDecisionMetrics
        {
            EnvId = envId,
            Id = id,
            Update = update
        });

        return Ok(experiment);
    }

    [HttpPost("{id:guid}/runs")]
    public async Task<ApiResponse<ReleaseDecisionExperimentDetailVm>> CreateRunAsync(Guid envId, Guid id)
    {
        var experiment = await Mediator.Send(new CreateReleaseDecisionExperimentRun
        {
            EnvId = envId,
            Id = id
        });

        return Ok(experiment);
    }

    [HttpDelete("{id:guid}/runs/{runId:guid}")]
    public async Task<ApiResponse<ReleaseDecisionExperimentDetailVm>> DeleteRunAsync(Guid envId, Guid id, Guid runId)
    {
        var experiment = await Mediator.Send(new DeleteReleaseDecisionExperimentRun
        {
            EnvId = envId,
            Id = id,
            RunId = runId
        });

        return Ok(experiment);
    }

    [HttpPut("{id:guid}/runs/{runId:guid}")]
    public async Task<ApiResponse<ReleaseDecisionExperimentDetailVm>> UpdateRunAsync(
        Guid envId,
        Guid id,
        Guid runId,
        ReleaseDecisionExperimentRunUpdate update)
    {
        var experiment = await Mediator.Send(new UpdateReleaseDecisionExperimentRun
        {
            EnvId = envId,
            Id = id,
            RunId = runId,
            Update = update
        });

        return Ok(experiment);
    }

    [HttpPut("{id:guid}/runs/{runId:guid}/audience")]
    public async Task<ApiResponse<ReleaseDecisionExperimentDetailVm>> UpdateRunAudienceAsync(
        Guid envId,
        Guid id,
        Guid runId,
        ReleaseDecisionExperimentRunAudienceUpdate update)
    {
        var experiment = await Mediator.Send(new UpdateReleaseDecisionExperimentRunAudience
        {
            EnvId = envId,
            Id = id,
            RunId = runId,
            Update = update
        });

        return Ok(experiment);
    }

    [HttpPut("{id:guid}/runs/{runId:guid}/observation-window")]
    public async Task<ApiResponse<ReleaseDecisionExperimentDetailVm>> UpdateRunObservationWindowAsync(
        Guid envId,
        Guid id,
        Guid runId,
        ReleaseDecisionExperimentRunObservationWindowUpdate update)
    {
        var experiment = await Mediator.Send(new UpdateReleaseDecisionExperimentRunObservationWindow
        {
            EnvId = envId,
            Id = id,
            RunId = runId,
            Update = update
        });

        return Ok(experiment);
    }

    [HttpPost("{id:guid}/runs/{runId:guid}/analyze")]
    public async Task<ApiResponse<ReleaseDecisionExperimentDetailVm>> AnalyzeRunAsync(
        Guid envId,
        Guid id,
        Guid runId,
        ReleaseDecisionExperimentRunAnalyzeRequest request)
    {
        var experiment = await Mediator.Send(new AnalyzeReleaseDecisionExperimentRun
        {
            EnvId = envId,
            Id = id,
            RunId = runId,
            Request = request
        });

        return Ok(experiment);
    }

    [HttpPost("{id:guid}/messages")]
    public async Task<ApiResponse<ReleaseDecisionExperimentDetailVm>> AddMessageAsync(
        Guid envId,
        Guid id,
        ReleaseDecisionExperimentMessageCreation message)
    {
        var experiment = await Mediator.Send(new CreateReleaseDecisionExperimentMessage
        {
            EnvId = envId,
            Id = id,
            Message = message
        });

        return Ok(experiment);
    }
}

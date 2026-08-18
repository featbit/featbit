using Application.Bases.Models;
using Application.Experiments;
using Api.Authentication;
using Domain.Policies;

namespace Api.Controllers;

[Authorize(Permissions.CanAccessEnv)]
[Route("api/v{version:apiVersion}/envs/{envId:guid}/experiments")]
public class ExperimentController : ApiControllerBase
{
    [OpenApi]
    [HttpPost]
    public async Task<ApiResponse<ExperimentVm>> CreateAsync(
        Guid envId,
        CreateExperiment request)
    {
        request.EnvId = envId;

        var experiment = await Mediator.Send(request);
        return Ok(experiment);
    }

    [OpenApi]
    [HttpGet]
    public async Task<ApiResponse<PagedResult<ExperimentVm>>> GetListAsync(
        Guid envId,
        [FromQuery] ExperimentFilter filter)
    {
        var request = new QueryExperiments
        {
            EnvId = envId,
            Filter = filter
        };

        var experiments = await Mediator.Send(request);
        return Ok(experiments);
    }

    [OpenApi]
    [HttpGet("{id:guid}")]
    public async Task<ApiResponse<ExperimentDetailVm>> GetAsync(Guid envId, Guid id)
    {
        var experiment = await Mediator.Send(new GetExperiment
        {
            EnvId = envId,
            Id = id
        });

        return Ok(experiment);
    }

    [OpenApi]
    [HttpDelete("{id:guid}")]
    public async Task<ApiResponse<bool>> DeleteAsync(Guid envId, Guid id)
    {
        await Mediator.Send(new DeleteExperiment
        {
            EnvId = envId,
            Id = id
        });

        return Ok(true);
    }

    [OpenApi]
    [HttpPut("{id:guid}")]
    public async Task<ApiResponse<ExperimentDetailVm>> UpdateAsync(
        Guid envId,
        Guid id,
        ExperimentUpdate update)
    {
        var experiment = await Mediator.Send(new UpdateExperiment
        {
            EnvId = envId,
            Id = id,
            Update = update
        });

        return Ok(experiment);
    }

    [OpenApi]
    [HttpPut("{id:guid}/stage")]
    public async Task<ApiResponse<ExperimentDetailVm>> UpdateStageAsync(
        Guid envId,
        Guid id,
        UpdateExperimentStage request)
    {
        request.EnvId = envId;
        request.Id = id;

        var experiment = await Mediator.Send(request);
        return Ok(experiment);
    }

    [OpenApi]
    [HttpPut("{id:guid}/metrics")]
    public async Task<ApiResponse<ExperimentDetailVm>> UpdateMetricsAsync(
        Guid envId,
        Guid id,
        ExperimentMetricsUpdate update)
    {
        var experiment = await Mediator.Send(new UpdateExperimentMetrics
        {
            EnvId = envId,
            Id = id,
            Update = update
        });

        return Ok(experiment);
    }

    [OpenApi]
    [HttpPost("{id:guid}/runs")]
    public async Task<ApiResponse<ExperimentDetailVm>> CreateRunAsync(Guid envId, Guid id)
    {
        var experiment = await Mediator.Send(new CreateExperimentRun
        {
            EnvId = envId,
            Id = id
        });

        return Ok(experiment);
    }

    [OpenApi]
    [HttpDelete("{id:guid}/runs/{runId:guid}")]
    public async Task<ApiResponse<ExperimentDetailVm>> DeleteRunAsync(Guid envId, Guid id, Guid runId)
    {
        var experiment = await Mediator.Send(new DeleteExperimentRun
        {
            EnvId = envId,
            Id = id,
            RunId = runId
        });

        return Ok(experiment);
    }

    [OpenApi]
    [HttpPut("{id:guid}/runs/{runId:guid}")]
    public async Task<ApiResponse<ExperimentDetailVm>> UpdateRunAsync(
        Guid envId,
        Guid id,
        Guid runId,
        ExperimentRunUpdate update)
    {
        var experiment = await Mediator.Send(new UpdateExperimentRun
        {
            EnvId = envId,
            Id = id,
            RunId = runId,
            Update = update
        });

        return Ok(experiment);
    }

    [OpenApi]
    [HttpPut("{id:guid}/runs/{runId:guid}/audience")]
    public async Task<ApiResponse<ExperimentDetailVm>> UpdateRunAudienceAsync(
        Guid envId,
        Guid id,
        Guid runId,
        ExperimentRunAudienceUpdate update)
    {
        var experiment = await Mediator.Send(new UpdateExperimentRunAudience
        {
            EnvId = envId,
            Id = id,
            RunId = runId,
            Update = update
        });

        return Ok(experiment);
    }

    [OpenApi]
    [HttpPut("{id:guid}/runs/{runId:guid}/observation-window")]
    public async Task<ApiResponse<ExperimentDetailVm>> UpdateRunObservationWindowAsync(
        Guid envId,
        Guid id,
        Guid runId,
        ExperimentRunObservationWindowUpdate update)
    {
        var experiment = await Mediator.Send(new UpdateExperimentRunObservationWindow
        {
            EnvId = envId,
            Id = id,
            RunId = runId,
            Update = update
        });

        return Ok(experiment);
    }

    [OpenApi]
    [HttpPost("{id:guid}/runs/{runId:guid}/analyze")]
    public async Task<ApiResponse<ExperimentDetailVm>> AnalyzeRunAsync(
        Guid envId,
        Guid id,
        Guid runId,
        ExperimentRunAnalyzeRequest request)
    {
        var experiment = await Mediator.Send(new AnalyzeExperimentRun
        {
            EnvId = envId,
            Id = id,
            RunId = runId,
            Request = request
        });

        return Ok(experiment);
    }

}

using Application.Bases.Models;
using Application.ExperimentMetrics;
using Application.Experiments;
using Application.FeatureFlags;
using Domain.Experiments;

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
    
    [HttpPost]
    public async Task<ApiResponse<Experiment>> CreateAsync(Guid envId, CreateExperiment request)
    {
        request.EnvId = envId;

        var experiment = await Mediator.Send(request);
        return Ok(experiment);
    }
    
    [HttpGet("variation-experiment-references")]
    public async Task<ApiResponse<ICollection<ExperimentVm>>> IsVariationUsedAsync(Guid envId, Guid featureFlagId, string variationId)
    {
        var request = new GetFeatureFlagVariationExptReferences
        {
            EnvId = envId,
            FeatureFlagId = featureFlagId,
            VariationId = variationId
        };

        var expts = await Mediator.Send(request);
        return Ok(expts);
    }

    [HttpGet("status-count")]
    public async Task<ApiResponse<IEnumerable<ExperimentStatusCountVm>>> GetExperimentStatusCounterAsync(Guid envId)
    {
        var request = new GetExperimentStatusCount
        {
            EnvId = envId
        };

        var status = await Mediator.Send(request);
        return Ok(status);
    }
    
    [HttpPut("iteration-results")]
    public async Task<ApiResponse<IEnumerable<ExperimentIterationResultsVm>>> GetExperimentIterationResultsAsync(Guid envId, IEnumerable<ExperimentIterationParam> experimentIterationParam)
    {
        var request = new GetExperimentIterationResults
        {
            EnvId = envId,
            ExperimentIterationParam = experimentIterationParam
        };

        var results = await Mediator.Send(request);
        return Ok(results);
    }

    [HttpPost("{experimentId:guid}")]
    public async Task<ApiResponse<ExperimentIteration>> StartAsync(Guid envId, Guid experimentId)
    {
        var request = new StartExperiment
        {
            EnvId = envId,
            ExperimentId = experimentId
        };

        var iteration = await Mediator.Send(request);
        return Ok(iteration);
    }

    [HttpDelete("{experimentId}/iterations")]
    public async Task<ApiResponse<bool>> ArchiveExperimentIterations(Guid envId, Guid experimentId)
    {
        var request = new ArchiveExperimentIterations
        {
            EnvId = envId,
            ExperimentId = experimentId
        };

        var success = await Mediator.Send(request);
        return Ok(success);
    }

    [HttpPut("{experimentId:guid}")]
    public async Task<ApiResponse<bool>> StopAsync(Guid envId, Guid experimentId)
    {
        var request = new StopExperiment
        {
            EnvId = envId,
            ExperimentId = experimentId
        };

        var success = await Mediator.Send(request);
        return Ok(success);
    }

    [HttpDelete("{experimentId}")]
    public async Task<ApiResponse<bool>> ArchiveExperimentAsync(Guid envId, Guid experimentId)
    {
        var request = new ArchiveExperiment
        {
            EnvId = envId,
            ExperimentId = experimentId
        };

        var success = await Mediator.Send(request);
        return Ok(success);
    }
}
using Application.Experiments;

namespace Application.FeatureFlags;

/// <summary>
/// Experiments that currently depend on the flag's insight data (a run whose observation window has not ended).
/// </summary>
public class GetRunningExperiments : IRequest<IReadOnlyList<ExperimentRef>>
{
    public Guid EnvId { get; set; }

    public string Key { get; set; }
}

public class GetRunningExperimentsHandler(
    IFeatureFlagService flagService,
    IExperimentService experimentService,
    TimeProvider timeProvider)
    : IRequestHandler<GetRunningExperiments, IReadOnlyList<ExperimentRef>>
{
    public async Task<IReadOnlyList<ExperimentRef>> Handle(
        GetRunningExperiments request,
        CancellationToken cancellationToken)
    {
        var flag = await flagService.GetAsync(request.EnvId, request.Key);

        return await experimentService.GetRunningForFlagAsync(
            request.EnvId, flag.Id, timeProvider.GetUtcNow().UtcDateTime);
    }
}

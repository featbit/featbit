namespace Application.FeatureFlags;

/// <summary>
/// Experiments that currently depend on the flag's insight data (a run whose observation window has not ended).
/// </summary>
public class GetRunningExperiments : IRequest<IReadOnlyList<ExperimentReference>>
{
    public Guid EnvId { get; set; }

    public string Key { get; set; }
}

public class GetRunningExperimentsHandler(IFeatureFlagService service)
    : IRequestHandler<GetRunningExperiments, IReadOnlyList<ExperimentReference>>
{
    public async Task<IReadOnlyList<ExperimentReference>> Handle(
        GetRunningExperiments request,
        CancellationToken cancellationToken)
    {
        var flag = await service.GetAsync(request.EnvId, request.Key);

        var experiments =
            await service.GetRunningExperimentsAsync(request.EnvId, flag.Id);

        return experiments;
    }
}

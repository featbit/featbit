using Application.Bases;

namespace Application.Experiments.ExperimentMetrics;

public class RestoreExperimentMetric : IRequest<bool>
{
    public Guid EnvId { get; set; }

    public Guid Id { get; set; }
}

public class RestoreExperimentMetricHandler(IExperimentMetricService service)
    : IRequestHandler<RestoreExperimentMetric, bool>
{
    public async Task<bool> Handle(RestoreExperimentMetric request, CancellationToken cancellationToken)
    {
        await service.RestoreAsync(request.EnvId, request.Id);
        return true;
    }
}

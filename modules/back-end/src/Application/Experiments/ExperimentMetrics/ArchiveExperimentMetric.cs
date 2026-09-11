using Application.Bases;

namespace Application.Experiments.ExperimentMetrics;

public class ArchiveExperimentMetric : IRequest<bool>
{
    public Guid EnvId { get; set; }

    public Guid Id { get; set; }
}

public class ArchiveExperimentMetricHandler(IExperimentMetricService service)
    : IRequestHandler<ArchiveExperimentMetric, bool>
{
    public async Task<bool> Handle(ArchiveExperimentMetric request, CancellationToken cancellationToken)
    {
        await service.ArchiveAsync(request.EnvId, request.Id);
        return true;
    }
}

using Application.Bases;
using Application.Bases.Exceptions;

namespace Application.ExperimentMetrics;

public class ArchiveExperimentMetric : IRequest<bool>
{
    public Guid Id { get; set; }
}

public class ArchiveExperimentMetricHandler : IRequestHandler<ArchiveExperimentMetric, bool>
{
    private readonly IExperimentMetricService _metricService;
    private readonly IExperimentService _experimentService;

    public ArchiveExperimentMetricHandler(
        IExperimentMetricService metricService,
        IExperimentService experimentService)
    {
        _metricService = metricService;
        _experimentService = experimentService;
    }

    public async Task<bool> Handle(ArchiveExperimentMetric request, CancellationToken cancellationToken)
    {
        var isBeingUsedByExperiment = await _experimentService.AnyAsync(x => x.MetricId == request.Id && !x.IsArchived);
        if (isBeingUsedByExperiment)
        {
            throw new BusinessException(ErrorCodes.MetricIsBeingUsedByExperiment);
        }

        var metric = await _metricService.GetAsync(request.Id);
        metric.UpdatedAt = DateTime.UtcNow;
        metric.IsArvhived = true;
        await _metricService.UpdateAsync(metric);

        return true;
    }
}
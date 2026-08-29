using Application.Bases;
using Application.Bases.Models;

namespace Application.Experiments.ExperimentMetrics;

public class GetExperimentMetricList : IRequest<PagedResult<ExperimentMetricVm>>
{
    public Guid EnvId { get; set; }

    public ExperimentMetricFilter Filter { get; set; }
}

public class GetExperimentMetricsHandler(
    IExperimentMetricService metricService,
    IExperimentService experimentService,
    IMapper mapper)
    : IRequestHandler<GetExperimentMetricList, PagedResult<ExperimentMetricVm>>
{
    public async Task<PagedResult<ExperimentMetricVm>> Handle(
        GetExperimentMetricList request,
        CancellationToken cancellationToken)
    {
        IReadOnlyCollection<string> referencedKeys = [];
        if (!string.IsNullOrWhiteSpace(request.Filter.SearchText))
        {
            var experimentsMatchingSearch = await experimentService.GetExperimentsWithRunsAsync(
                request.EnvId,
                request.Filter.SearchText);
            referencedKeys = experimentsMatchingSearch
                .SelectMany(ExperimentMetricReadModel.GetReferencedKeys)
                .Distinct(StringComparer.Ordinal)
                .ToArray();
        }

        var metrics = await metricService.GetListAsync(request.EnvId, request.Filter, referencedKeys);
        var result = mapper.Map<PagedResult<ExperimentMetricVm>>(metrics);
        if (metrics.Items.Count == 0)
        {
            return result;
        }

        var experimentsWithRuns = await experimentService.GetExperimentsWithRunsAsync(request.EnvId);

        foreach (var metric in metrics.Items)
        {
            var vm = result.Items.First(x => x.Id == metric.Id);
            vm.ExperimentUsage = experimentsWithRuns
                .Select(experimentWithRuns => ExperimentMetricReadModel.Build(metric, experimentWithRuns))
                .Where(x => x != null)
                .OrderBy(x => x.ExperimentName)
                .ThenBy(x => x.ExperimentId)
                .ToArray();
        }

        return result;
    }
}

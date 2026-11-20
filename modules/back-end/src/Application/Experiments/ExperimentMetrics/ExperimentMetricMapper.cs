using Application.Bases.Mapping;
using Application.Bases.Models;
using Domain.Experiments;
using Riok.Mapperly.Abstractions;

namespace Application.Experiments.ExperimentMetrics;

[Mapper]
public static partial class ExperimentMetricMapper
{
    // The experiment usage is computed by GetExperimentMetricListHandler.
    [MapperIgnoreTarget(nameof(ExperimentMetricVm.ExperimentUsage))]
    public static partial ExperimentMetricVm ToVm(ExperimentMetric metric);

    public static PagedResult<ExperimentMetricVm> ToVm(PagedResult<ExperimentMetric> metrics) =>
        MapperConventions.MapPage(metrics, ToVm);
}

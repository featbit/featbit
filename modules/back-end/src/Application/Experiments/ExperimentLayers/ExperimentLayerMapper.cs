using Application.Bases.Mapping;
using Application.Bases.Models;
using Domain.Experiments;
using Riok.Mapperly.Abstractions;

namespace Application.Experiments.ExperimentLayers;

[Mapper]
public static partial class ExperimentLayerMapper
{
    // The runs and the allocation summary are computed by GetExperimentLayerListHandler.
    [MapperIgnoreTarget(nameof(ExperimentLayerVm.ExperimentRuns))]
    [MapperIgnoreTarget(nameof(ExperimentLayerVm.AllocationSummary))]
    public static partial ExperimentLayerVm ToVm(ExperimentLayer layer);

    public static PagedResult<ExperimentLayerVm> ToVm(PagedResult<ExperimentLayer> layers) =>
        MapperConventions.MapPage(layers, ToVm);
}

using Application.Bases.Models;
using Domain.Experiments;

namespace Application.Experiments.ExperimentLayers;

public class MapperProfile : Profile
{
    public MapperProfile()
    {
        CreateMap<ExperimentLayer, ExperimentLayerVm>()
            .ForMember(x => x.ExperimentRuns, options => options.Ignore())
            .ForMember(x => x.AllocationSummary, options => options.Ignore());

        CreateMap<PagedResult<ExperimentLayer>, PagedResult<ExperimentLayerVm>>();
    }
}

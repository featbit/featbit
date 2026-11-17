using Application.Bases.Models;
using Domain.Experiments;

namespace Application.Experiments.ExperimentMetrics;

public class MapperProfile : Profile
{
    public MapperProfile()
    {
        CreateMap<ExperimentMetric, ExperimentMetricVm>()
            .ForMember(x => x.ExperimentUsage, options => options.Ignore());

        CreateMap<PagedResult<ExperimentMetric>, PagedResult<ExperimentMetricVm>>();
    }
}

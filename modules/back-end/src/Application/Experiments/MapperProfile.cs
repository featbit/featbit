using Application.Bases.Models;
using Domain.Experiments;

namespace Application.Experiments;

public class MapperProfile : Profile
{
    public MapperProfile()
    {
        CreateMap<ExperimentMetric, ExperimentMetricVm>();
        CreateMap<PagedResult<ExperimentMetric>, PagedResult<ExperimentMetricVm>>();
    }
}
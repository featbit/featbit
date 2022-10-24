using Application.Bases.Models;
using Domain.ExperimentMetrics;

namespace Application.ExperimentMetrics;

public class MapperProfile : Profile
{
    public MapperProfile()
    {
        CreateMap<ExperimentMetric, ExperimentMetricVm>();
        CreateMap<PagedResult<ExperimentMetric>, PagedResult<ExperimentMetricVm>>();
    }
}
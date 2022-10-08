using Application.Bases.Models;
using Domain.FeatureFlags;

namespace Application.FeatureFlags;

public class MapperProfile : Profile
{
    public MapperProfile()
    {
        CreateMap<FeatureFlag, FeatureFlagVm>();
        CreateMap<PagedResult<FeatureFlag>, PagedResult<FeatureFlagVm>>();
    }
}
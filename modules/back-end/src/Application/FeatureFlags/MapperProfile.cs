using Application.Bases.Models;
using Domain.FeatureFlags;

namespace Application.FeatureFlags;

public class MapperProfile : Profile
{
    public MapperProfile()
    {
        CreateMap<FeatureFlag, FeatureFlagVm>()
            .ForMember(dst => dst.Serves, opt => opt.MapFrom(x => x.Serves()));

        CreateMap<PagedResult<FeatureFlag>, PagedResult<FeatureFlagVm>>();
    }
}
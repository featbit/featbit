using Domain.CloudConfig;

namespace Application.CloudConfig;

public class MapperProfile : Profile
{
    public MapperProfile()
    {
        CreateMap<SocialProvider, SocialProviderVm>();
    }
}
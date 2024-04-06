using Domain.OAuthProviders;

namespace Application.OAuthProviders;

public class MapperProfile : Profile
{
    public MapperProfile()
    {
        CreateMap<OAuthProvider, OAuthProviderVm>();
    }
}
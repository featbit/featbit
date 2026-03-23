using Application.Bases.Models;
using Domain.AccessTokens;

namespace Application.AccessTokens;

public class MapperProfile : Profile
{
    public MapperProfile()
    {
        CreateMap<AccessToken, AccessTokenVm>()
            .ForMember(x => x.Token, opt => opt.MapFrom(src => $"{src.Token.Substring(0, 10)}**************"));

        CreateMap<PagedResult<AccessToken>, PagedResult<AccessTokenVm>>();
    }
}
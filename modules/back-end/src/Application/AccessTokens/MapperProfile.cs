using Application.Bases.Models;
using Domain.AccessTokens;

namespace Application.AccessTokens;

public class MapperProfile : Profile
{
    public MapperProfile()
    {
        CreateMap<AccessToken, AccessTokenVm>();
        CreateMap<PagedResult<AccessToken>, PagedResult<AccessTokenVm>>();
    }
}
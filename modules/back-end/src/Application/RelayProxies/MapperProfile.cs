using Application.Bases.Models;
using Application.RelayProxies;
using Domain.AccessTokens;
using Domain.RelayProxies;

namespace Application.RelayProxies;

public class MapperProfile : Profile
{
    public MapperProfile()
    {
        CreateMap<RelayProxy, RelayProxyVm>();
        CreateMap<PagedResult<RelayProxy>, PagedResult<RelayProxyVm>>();
    }
}
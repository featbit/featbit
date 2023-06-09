using Application.Bases.Models;
using Application.RelayProxies;
using Domain.AccessTokens;
using Domain.RelayProxies;
using Microsoft.Extensions.DependencyInjection.RelayProxies;

namespace Application.RelayProxies;

public class MapperProfile : Profile
{
    public MapperProfile()
    {
        CreateMap<RelayProxy, RelayProxyVm>();
        CreateMap<AgentStatus, ProxyAgentStatusVm>();
        CreateMap<PagedResult<RelayProxy>, PagedResult<RelayProxyVm>>();
    }
}
using Application.Bases.Models;
using Domain.RelayProxies;

namespace Application.RelayProxies;

public class MapperProfile : Profile
{
    public MapperProfile()
    {
        CreateMap<RelayProxy, RelayProxyVm>()
            .ForMember(dest => dest.Key, opt => opt.MapFrom(src => src.Key.Substring(0, 15) + "**************"))
            .ForMember(
                dest => dest.AutoAgents, opt => opt.MapFrom(src => src.AutoAgents.OrderByDescending(x => x.RegisteredAt))
            );

        CreateMap<PagedResult<RelayProxy>, PagedResult<RelayProxyVm>>();
    }
}
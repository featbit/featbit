using Application.Bases.Models;
using Domain.EndUsers;

namespace Application.GlobalUsers;

public class MapperProfile : Profile
{
    public MapperProfile()
    {
        CreateMap<EndUser, GlobalUser>();
        CreateMap<PagedResult<EndUser>, PagedResult<GlobalUser>>();
    }
}
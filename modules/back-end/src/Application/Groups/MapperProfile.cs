using Application.Bases.Models;
using Domain.Groups;

namespace Application.Groups;

public class MapperProfile : Profile
{
    public MapperProfile()
    {
        CreateMap<Group, GroupVm>();
        CreateMap<PagedResult<Group>, PagedResult<GroupVm>>();
    }
}
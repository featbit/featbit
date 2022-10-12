using Application.Bases.Models;
using Domain.Resources;

namespace Application.Resources;

public class MapperProfile : Profile
{
    public MapperProfile()
    {
        CreateMap<Resource, ResourceVm>();
        CreateMap<PagedResult<Resource>, PagedResult<ResourceVm>>();
    }
}
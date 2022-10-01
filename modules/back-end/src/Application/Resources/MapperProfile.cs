using Application.Bases.Models;
using Application.Organizations;
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
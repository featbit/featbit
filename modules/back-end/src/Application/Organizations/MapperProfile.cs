using AutoMapper;
using Domain.Organizations;

namespace Application.Organizations;

public class MapperProfile : Profile
{
    public MapperProfile()
    {
        CreateMap<Organization, OrganizationVm>();
    }
}
using Domain.Organizations;

namespace Application.Organizations;

public class MapperProfile : Profile
{
    public MapperProfile()
    {
        CreateMap<Organization, OrganizationVm>()
            .ForMember(x => x.DefaultPermissions, opt => opt.NullSubstitute(new OrganizationPermissions()))
            .ForMember(x => x.Settings, opt => opt.NullSubstitute(new OrganizationSetting()));
    }
}
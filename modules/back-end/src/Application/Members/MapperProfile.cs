using Application.Bases.Models;
using Domain.Members;

namespace Application.Members;

public class MapperProfile : Profile
{
    public MapperProfile()
    {
        CreateMap<Member, MemberVm>();
        CreateMap<Member, MemberLookupVm>();
        CreateMap<MemberGroup, MemberGroupVm>();

        CreateMap<PagedResult<Member>, PagedResult<MemberVm>>();
        CreateMap<PagedResult<MemberGroup>, PagedResult<MemberGroupVm>>();

        CreateMap<PagedResult<Member>, PagedResult<MemberLookupVm>>();
    }
}

using Application.Bases.Models;
using Domain.Members;

namespace Application.Members;

public class MapperProfile : Profile
{
    public MapperProfile()
    {
        CreateMap<Member, MemberVm>();
        CreateMap<MemberGroup, MemberGroupVm>();

        CreateMap<PagedResult<Member>, PagedResult<MemberVm>>();
        CreateMap<PagedResult<MemberGroup>, PagedResult<MemberGroupVm>>();
    }
}
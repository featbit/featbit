using Application.Bases.Models;
using Application.Policies;
using Domain.Members;
using Domain.Policies;

namespace Application.Members;

public class MapperProfile : Profile
{
    public MapperProfile()
    {
        CreateMap<Member, MemberVm>();
        CreateMap<MemberGroup, MemberGroupVm>();
        CreateMap<Policy, PolicyVm>();

        CreateMap<PagedResult<Member>, PagedResult<MemberVm>>();
        CreateMap<PagedResult<MemberGroup>, PagedResult<MemberGroupVm>>();
        CreateMap<PagedResult<Policy>, PagedResult<PolicyVm>>();
    }
}
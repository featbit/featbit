using Application.Bases.Models;
using Domain.Policies;

namespace Application.Policies;

public class MapperProfile : Profile
{
    public MapperProfile()
    {
        CreateMap<Policy, PolicyVm>();
        CreateMap<IEnumerable<PolicyVm>, IEnumerable<Policy>>();
        CreateMap<PagedResult<Policy>, PagedResult<PolicyVm>>();
    }
}
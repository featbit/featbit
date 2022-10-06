using Application.Bases.Models;
using Domain.Segments;

namespace Application.Segments;

public class MapperProfile : Profile
{
    public MapperProfile()
    {
        CreateMap<Segment, SegmentVm>();
        CreateMap<PagedResult<Segment>, PagedResult<SegmentVm>>();
    }
}
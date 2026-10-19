using Application.Bases.Models;
using Domain.AuditLogs;

namespace Application.AuditLogs;

public class MapperProfile : Profile
{
    public MapperProfile()
    {
        CreateMap<DataChange, AuditDataChangeVm>();
        CreateMap<AuditLog, AuditLogVm>()
            .ForMember(dest => dest.Source, opt => opt.MapFrom(src => src.DataChange.Source));
        CreateMap<PagedResult<AuditLog>, PagedResult<AuditLogVm>>();
    }
}

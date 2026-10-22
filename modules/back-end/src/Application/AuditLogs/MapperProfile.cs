using Application.Bases.Models;
using Domain.AuditLogs;

namespace Application.AuditLogs;

public class MapperProfile : Profile
{
    public MapperProfile()
    {
        CreateMap<AuditLog, AuditLogVm>();
        CreateMap<PagedResult<AuditLog>, PagedResult<AuditLogVm>>();
    }
}
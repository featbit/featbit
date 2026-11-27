using Application.Bases.Mapping;
using Application.Bases.Models;
using Domain.AuditLogs;
using Riok.Mapperly.Abstractions;

namespace Application.AuditLogs;

[Mapper]
public static partial class AuditLogMapper
{
    // The creator's name and email and the instructions are filled in by the list handlers.
    [MapperIgnoreTarget(nameof(AuditLogVm.CreatorName))]
    [MapperIgnoreTarget(nameof(AuditLogVm.CreatorEmail))]
    [MapperIgnoreTarget(nameof(AuditLogVm.Instructions))]
    public static partial AuditLogVm ToVm(AuditLog auditLog);

    public static PagedResult<AuditLogVm> ToVm(PagedResult<AuditLog> auditLogs) =>
        MapperConventions.MapPage(auditLogs, ToVm);
}

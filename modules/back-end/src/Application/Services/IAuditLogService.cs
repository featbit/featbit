#nullable enable

using Application.AuditLogs;
using Application.Bases.Models;
using Domain.AuditLogs;

namespace Application.Services;

public interface IAuditLogService : IService<AuditLog>
{
    public Task<PagedResult<AuditLog>> GetListAsync(Guid envId, AuditLogFilter filter);

    Task<LastChange?> GetLastChangeAsync(Guid envId, string refType, string refId);

    Task<ICollection<LastChange>> GetLastChangesAsync(Guid envId, string refType, ICollection<string> refIds);
}
#nullable enable

using Application.AuditLogs;
using Application.Bases.Models;
using Domain.AuditLogs;

namespace Application.Services;

public interface IAuditLogService : IService<AuditLog>
{
    public Task<PagedResult<AuditLog>> GetListAsync(Guid workspaceId, Guid envId, AuditLogFilter filter);

    Task<PagedResult<AuditLog>> GetListAsync(Guid workspaceId, AuditLogQueryFilter filter);

    Task<LastChange?> GetLastChangeAsync(Guid workspaceId, Guid envId, string refType, string refId);

    Task<ICollection<LastChange>> GetLastChangesAsync(Guid workspaceId, Guid envId, string refType, ICollection<string> refIds);
}

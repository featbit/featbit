using Application.AuditLogs;
using Domain.Policies;

namespace Application.Services;

public interface IAuditLogAccess
{
    Task EnsureAsync(AuditLogFilter filter, PolicyStatement[] permissions);
}

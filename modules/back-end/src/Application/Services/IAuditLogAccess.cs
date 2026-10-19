namespace Application.Services;

public interface IAuditLogAccess
{
    Task EnsureAsync(Guid workspaceId, Guid orgId);
}

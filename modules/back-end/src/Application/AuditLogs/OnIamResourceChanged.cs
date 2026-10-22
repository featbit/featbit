#nullable enable

using Domain.AuditLogs;

namespace Application.AuditLogs;

public record OnIamResourceChanged(
    Guid WorkspaceId,
    Guid? OrganizationId,
    string RefType,
    string Operation,
    IamAuditSnapshot? Resource,
    DataChange Change,
    Guid OperatorId,
    string Comment = "") : INotification
{
    public AuditLog? GetAuditLog()
    {
        if (Change.Previous == Change.Current) return null;
        var identity = Resource;
        if (identity == null) return null;
        var keyword = $"{identity.Name} {identity.Rn}";

        return new AuditLog(
            WorkspaceId,
            OrganizationId,
            null,
            identity.Id.ToString(),
            RefType,
            keyword[..Math.Min(keyword.Length, 512)],
            Operation,
            Change,
            Comment,
            OperatorId);
    }
}

public class OnIamResourceChangedHandler(IAuditLogService logs) : INotificationHandler<OnIamResourceChanged>
{
    public async Task Handle(OnIamResourceChanged notification, CancellationToken cancellationToken)
    {
        var log = notification.GetAuditLog();
        if (log != null)
        {
            await logs.AddOneAsync(log);
        }
    }
}

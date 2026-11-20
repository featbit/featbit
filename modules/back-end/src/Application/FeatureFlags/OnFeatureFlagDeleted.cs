using Application.Caches;
using Domain.AuditLogs;
using Domain.FeatureFlags;

namespace Application.FeatureFlags;

public class OnFeatureFlagDeleted : INotification
{
    public Guid WorkspaceId { get; }

    public Guid OrganizationId { get; }

    public FeatureFlag Flag { get; set; }

    public Guid OperatorId { get; set; }

    public DataChange DataChange { get; set; }

    public string Comment { get; set; }

    public OnFeatureFlagDeleted(FeatureFlag flag, Guid workspaceId, Guid organizationId, Guid operatorId, string comment = "")
    {
        WorkspaceId = workspaceId;
        OrganizationId = organizationId;
        Flag = flag;
        OperatorId = operatorId;
        Comment = comment;
        DataChange = new DataChange(flag).To(null);
    }

    public AuditLog GetAuditLog()
    {
        var auditLog = AuditLog.For(Flag, WorkspaceId, OrganizationId, Operations.Remove, DataChange, Comment, OperatorId);
        return auditLog;
    }
}

public class OnFeatureFlagDeletedHandler(
    ICacheService cache,
    IAuditLogService auditLogService,
    IWebhookHandler webhookHandler,
    IFeatureFlagChangePublisher changePublisher)
    : INotificationHandler<OnFeatureFlagDeleted>
{
    public async ValueTask Handle(OnFeatureFlagDeleted notification, CancellationToken cancellationToken)
    {
        // write audit log
        await auditLogService.AddOneAsync(notification.GetAuditLog());

        // delete cache
        var envId = notification.Flag.EnvId;
        var flagId = notification.Flag.Id;
        await cache.DeleteFlagAsync(envId, flagId);

        // handle webhooks
        _ = webhookHandler.HandleAsync(notification.Flag, notification.DataChange, notification.OperatorId);

        // publish flag deletion message
        await changePublisher.PublishDeletedAsync(envId, flagId);
    }
}

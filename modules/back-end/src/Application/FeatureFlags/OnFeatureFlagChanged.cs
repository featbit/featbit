using Application.Caches;
using Domain.AuditLogs;
using Domain.FeatureFlags;
using Domain.FlagRevisions;
using Microsoft.Extensions.Configuration;

namespace Application.FeatureFlags;

public class OnFeatureFlagChanged : INotification
{
    public FeatureFlag Flag { get; set; }

    public string Operation { get; set; }

    public DataChange DataChange { get; set; }

    public Guid OperatorId { get; set; }

    public string Comment { get; set; }

    public OnFeatureFlagChanged(
        FeatureFlag flag,
        string operation,
        DataChange dataChange,
        Guid operatorId,
        string comment = "")
    {
        Flag = flag;
        Operation = operation;
        DataChange = dataChange;
        OperatorId = operatorId;
        Comment = comment;
    }

    public AuditLog GetAuditLog()
    {
        var auditLog = AuditLog.For(Flag, Operation, DataChange, Comment, OperatorId);

        return auditLog;
    }
}

public class OnFeatureFlagChangedHandler(
    IFlagRevisionService flagRevisionService,
    ICacheService cache,
    IAuditLogService auditLogService,
    IWebhookHandler webhookHandler,
    IFeatureFlagChangePublisher featureFlagChangePublisher, 
    IConfiguration configuration)
    : INotificationHandler<OnFeatureFlagChanged>
{
    public async Task Handle(OnFeatureFlagChanged notification, CancellationToken cancellationToken)
    {
        var flag = notification.Flag;

        // write audit log
        await auditLogService.AddOneAsync(notification.GetAuditLog());

        // update cache
        await cache.UpsertFlagAsync(flag);

        // create flag revision
        var revision = new FlagRevision(flag, notification.Comment);
        await flagRevisionService.AddOneAsync(revision);

        // publish feature flag change message
        await featureFlagChangePublisher.PublishAsync(notification);

        if (!configuration.UseControlPlane())
        {
            // handle webhooks
            _ = webhookHandler.HandleAsync(notification.Flag, notification.DataChange, notification.OperatorId);
        }
        
    }
}
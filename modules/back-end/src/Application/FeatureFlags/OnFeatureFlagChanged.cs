using Application.Caches;
using Domain.AuditLogs;
using Domain.FeatureFlags;
using Domain.FlagRevisions;
using Domain.Observability;
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

        // Tag this change so every stage below — cache write, revision, publish, webhook — and every
        // service that later consumes the message can be tied to one logical change. Derived from
        // the change's own identity, so consumers compute the same value without it being carried
        // on the wire (docs/observability/index.md §7).
        ActivityCorrelation.SetChangeId(
            ChangeId.For(ChangeId.FlagResource, flag.EnvId, flag.Key, flag.UpdatedAt));

        using (var persist = PropagationMetrics.Current.BeginStage(
                   ChangeId.FlagResource, PropagationStages.Persist))
        {
            // write audit log
            await auditLogService.AddOneAsync(notification.GetAuditLog());

            // update cache
            await cache.UpsertFlagAsync(flag);

            // create flag revision
            var revision = new FlagRevision(flag, notification.Comment);
            await flagRevisionService.AddOneAsync(revision);

            persist.Succeeded();
        }

        using (var publish = PropagationMetrics.Current.BeginStage(
                   ChangeId.FlagResource, PropagationStages.Publish))
        {
            // publish feature flag change message
            await featureFlagChangePublisher.PublishAsync(notification);

            // Success here means the publisher returned, which for a fire-and-forget transport is
            // "enqueued", not "delivered" — messaging.published carries the honest per-transport
            // outcome. See follow-up F5.
            publish.Succeeded();
        }

        if (!configuration.UseControlPlane())
        {
            // handle webhooks
            _ = webhookHandler.HandleAsync(notification.Flag, notification.DataChange, notification.OperatorId);
        }
    }
}
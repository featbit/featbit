using Application.Caches;
using Domain.AuditLogs;
using Domain.Observability;
using Domain.Segments;
using Microsoft.Extensions.Configuration;

namespace Application.Segments;

public class OnSegmentChange : INotification
{
    public Segment Segment { get; set; }

    public string Operation { get; set; }

    public DataChange DataChange { get; set; }

    public Guid OperatorId { get; set; }

    public string Comment { get; set; }

    public bool IsTargetingChange { get; set; }

    public OnSegmentChange(
        Segment segment,
        string operation,
        DataChange dataChange,
        Guid operatorId,
        string comment = "",
        bool isTargetingChange = false)
    {
        Segment = segment;
        Operation = operation;
        DataChange = dataChange;
        OperatorId = operatorId;
        Comment = comment;
        IsTargetingChange = isTargetingChange;
    }

    public AuditLog GetAuditLog()
    {
        var auditLog = AuditLog.For(Segment, Operation, DataChange, Comment, OperatorId);

        return auditLog;
    }
}

public class OnSegmentChangeHandler(
    ISegmentService segmentService,
    ICacheService cache,
    IAuditLogService auditLogService,
    IWebhookHandler webhookHandler,
    ISegmentChangePublisher segmentChangePublisher,
    IConfiguration configuration)
    : INotificationHandler<OnSegmentChange>
{
    public async Task Handle(OnSegmentChange notification, CancellationToken cancellationToken)
    {
        var segment = notification.Segment;

        // Tag this change so every stage below and every service that later consumes the message can
        // be tied to one logical change (docs/observability/index.md §7).
        ActivityCorrelation.SetChangeId(
            ChangeId.For(ChangeId.SegmentResource, segment.EnvId, segment.Key, segment.UpdatedAt));

        ICollection<Guid> envIds;

        using (var persist = PropagationMetrics.Current.BeginStage(
                   ChangeId.SegmentResource, PropagationStages.Persist))
        {
            // write audit log
            await auditLogService.AddOneAsync(notification.GetAuditLog());

            envIds = await segmentService.GetEnvironmentIdsAsync(segment);

            // update cache
            await cache.UpsertSegmentAsync(envIds, segment);

            persist.Succeeded();
        }

        using (var publish = PropagationMetrics.Current.BeginStage(
                   ChangeId.SegmentResource, PropagationStages.Publish))
        {
            await segmentChangePublisher.PublishAsync(notification);
            publish.Succeeded();
        }

        if (!configuration.UseControlPlane())
        {
            foreach (var envId in envIds)
            {
                // handle webhook asynchronously
                _ = webhookHandler.HandleAsync(
                    envId,
                    segment,
                    notification.DataChange,
                    notification.OperatorId
                );
            }
        }
    }
}
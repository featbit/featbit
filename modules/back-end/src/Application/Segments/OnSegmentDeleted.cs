using Application.Caches;
using Domain.AuditLogs;
using Domain.Segments;

namespace Application.Segments;

public class OnSegmentDeleted : INotification
{
    public Guid WorkspaceId { get; }

    public Guid OrganizationId { get; }

    public Segment Segment { get; set; }

    public Guid OperatorId { get; set; }

    public DataChange DataChange { get; set; }

    public string Comment { get; set; }

    public OnSegmentDeleted(Segment segment, Guid workspaceId, Guid organizationId, Guid operatorId, string comment = "")
    {
        WorkspaceId = workspaceId;
        OrganizationId = organizationId;
        Segment = segment;
        OperatorId = operatorId;
        DataChange = new DataChange(segment).To(null);
        Comment = comment;
    }

    public AuditLog GetAuditLog()
    {
        var auditLog = AuditLog.For(Segment, WorkspaceId, OrganizationId, Operations.Remove, DataChange, Comment, OperatorId);
        return auditLog;
    }
}

public class OnSegmentDeletedHandler(
    ICacheService cache,
    IAuditLogService auditLogService,
    IWebhookHandler webhookHandler,
    ISegmentService segmentService,
    ISegmentChangePublisher changePublisher)
    : INotificationHandler<OnSegmentDeleted>
{
    public async ValueTask Handle(OnSegmentDeleted notification, CancellationToken cancellationToken)
    {
        // write audit log
        await auditLogService.AddOneAsync(notification.GetAuditLog());

        var segment = notification.Segment;
        var envIds = await segmentService.GetEnvironmentIdsAsync(segment);

        // delete cache
        await cache.DeleteSegmentAsync(envIds, segment.Id);

        // handle webhooks
        foreach (var envId in envIds)
        {
            _ = webhookHandler.HandleAsync(
                envId,
                notification.Segment,
                notification.DataChange,
                notification.OperatorId
            );
        }

        // publish segment deletion message
        await changePublisher.PublishDeletedAsync(envIds, segment.Id);
    }
}

using Application.Caches;
using Domain.AuditLogs;
using Domain.Segments;

namespace Application.Segments;

public class OnSegmentDeleted : INotification
{
    public Segment Segment { get; set; }

    public Guid OperatorId { get; set; }

    public DataChange DataChange { get; set; }

    public OnSegmentDeleted(Segment segment, Guid operatorId)
    {
        Segment = segment;
        OperatorId = operatorId;
        DataChange = new DataChange(segment).To(null);
    }

    public AuditLog GetAuditLog()
    {
        var auditLog = AuditLog.For(Segment, Operations.Remove, DataChange, string.Empty, OperatorId);
        return auditLog;
    }
}

public class OnSegmentDeletedHandler : INotificationHandler<OnSegmentDeleted>
{
    private readonly ICacheService _cache;
    private readonly IAuditLogService _auditLogService;
    private readonly IWebhookHandler _webhookHandler;

    public OnSegmentDeletedHandler(
        ICacheService cache,
        IAuditLogService auditLogService,
        IWebhookHandler webhookHandler)
    {
        _cache = cache;
        _auditLogService = auditLogService;
        _webhookHandler = webhookHandler;
    }

    public async Task Handle(OnSegmentDeleted notification, CancellationToken cancellationToken)
    {
        // write audit log
        await _auditLogService.AddOneAsync(notification.GetAuditLog());

        // delete cache
        var envId = notification.Segment.EnvId;
        var segmentId = notification.Segment.Id;
        await _cache.DeleteSegmentAsync(envId, segmentId);

        // handle webhooks
        _ = _webhookHandler.HandleAsync(notification.Segment, notification.DataChange, notification.OperatorId);
    }
}
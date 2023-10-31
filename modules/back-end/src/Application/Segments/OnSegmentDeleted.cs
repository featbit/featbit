using Application.Caches;
using Domain.AuditLogs;
using Domain.Segments;

namespace Application.Segments;

public class OnSegmentDeleted : INotification
{
    public Segment Segment { get; set; }

    public Guid OperatorId { get; set; }

    public OnSegmentDeleted(Segment segment, Guid currentUserId)
    {
        Segment = segment;
        OperatorId = currentUserId;
    }

    public AuditLog GetAuditLog()
    {
        var auditLog = AuditLog.For(Segment, Operations.Remove, DataChange.Empty, string.Empty, OperatorId);

        return auditLog;
    }
}

public class OnSegmentDeletedHandler : INotificationHandler<OnSegmentDeleted>
{
    private readonly ICacheService _cache;
    private readonly IAuditLogService _auditLogService;

    public OnSegmentDeletedHandler(ICacheService cache, IAuditLogService auditLogService)
    {
        _cache = cache;
        _auditLogService = auditLogService;
    }

    public async Task Handle(OnSegmentDeleted notification, CancellationToken cancellationToken)
    {
        // write audit log
        await _auditLogService.AddOneAsync(notification.GetAuditLog());

        // delete cache
        var envId = notification.Segment.EnvId;
        var segmentId = notification.Segment.Id;
        await _cache.DeleteSegmentAsync(envId, segmentId);
    }
}
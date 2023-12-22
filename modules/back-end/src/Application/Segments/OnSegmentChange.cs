using Application.Caches;
using Domain.AuditLogs;
using Domain.Messages;
using Domain.Segments;

namespace Application.Segments;

public class OnSegmentChange : INotification
{
    public Segment Segment { get; set; }

    public IEnumerable<Guid> AffectedFlagIds { get; set; }

    public string Operation { get; set; }

    public DataChange DataChange { get; set; }

    public Guid OperatorId { get; set; }

    public string Comment { get; set; }

    public OnSegmentChange(Segment segment, string operation, DataChange dataChange, Guid operatorId, string comment = "")
    {
        Segment = segment;
        AffectedFlagIds = Array.Empty<Guid>();
        Operation = operation;
        DataChange = dataChange;
        OperatorId = operatorId;
        Comment = comment;
    }

    public OnSegmentChange(
        Segment segment,
        IEnumerable<Guid> affectedFlagIds,
        string operation,
        DataChange dataChange,
        Guid operatorId,
        string comment = "")
    {
        Segment = segment;
        AffectedFlagIds = affectedFlagIds;
        Operation = operation;
        DataChange = dataChange;
        OperatorId = operatorId;
        Comment = comment;
    }

    public AuditLog GetAuditLog()
    {
        var auditLog = AuditLog.For(Segment, Operation, DataChange, Comment, OperatorId);

        return auditLog;
    }
}

public class OnSegmentChangeHandler : INotificationHandler<OnSegmentChange>
{
    private readonly IMessageProducer _messageProducer;
    private readonly ICacheService _cache;
    private readonly IAuditLogService _auditLogService;
    private readonly IWebhookHandler _webhookHandler;

    public OnSegmentChangeHandler(
        IMessageProducer messageProducer,
        ICacheService cache,
        IAuditLogService auditLogService,
        IWebhookHandler webhookHandler)
    {
        _messageProducer = messageProducer;
        _cache = cache;
        _auditLogService = auditLogService;
        _webhookHandler = webhookHandler;
    }

    public async Task Handle(OnSegmentChange notification, CancellationToken cancellationToken)
    {
        // write audit log
        await _auditLogService.AddOneAsync(notification.GetAuditLog());

        // update cache
        await _cache.UpsertSegmentAsync(notification.Segment);

        // publish segment change message
        await _messageProducer.PublishAsync(Topics.SegmentChange, notification);

        // handle webhooks
        _ = _webhookHandler.HandleAsync(notification.Segment, notification.DataChange, notification.OperatorId);
    }
}
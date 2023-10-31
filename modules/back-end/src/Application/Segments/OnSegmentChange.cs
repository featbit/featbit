using Application.Caches;
using Domain.AuditLogs;
using Domain.Messages;
using Domain.Segments;

namespace Application.Segments;

public class OnSegmentChange : INotification
{
    public Segment Segment { get; set; }

    public string Operation { get; set; }

    public DataChange DataChange { get; set; }

    public Guid OperatorId { get; set; }

    public IEnumerable<Guid> AffectedFlagIds { get; set; }

    public OnSegmentChange(Segment segment, string operation, DataChange dataChange, Guid operatorId)
    {
        Segment = segment;
        Operation = operation;
        DataChange = dataChange;
        OperatorId = operatorId;
        AffectedFlagIds = Array.Empty<Guid>();
    }

    public OnSegmentChange(Segment segment, IEnumerable<Guid> affectedFlagIds)
    {
        Segment = segment;
        AffectedFlagIds = affectedFlagIds;
    }

    public AuditLog GetAuditLog()
    {
        var auditLog = AuditLog.For(Segment, Operations.Update, DataChange, string.Empty, OperatorId);

        return auditLog;
    }
}

public class OnSegmentChangeHandler : INotificationHandler<OnSegmentChange>
{
    private readonly IMessageProducer _messageProducer;
    private readonly ICacheService _cache;

    public OnSegmentChangeHandler(IMessageProducer messageProducer, ICacheService cache)
    {
        _messageProducer = messageProducer;
        _cache = cache;
    }

    public async Task Handle(OnSegmentChange notification, CancellationToken cancellationToken)
    {
        // update cache
        await _cache.UpsertSegmentAsync(notification.Segment);

        // publish segment change message
        await _messageProducer.PublishAsync(Topics.SegmentChange, notification);
    }
}
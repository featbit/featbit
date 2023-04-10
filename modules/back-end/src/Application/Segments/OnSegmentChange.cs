using Application.Caches;
using Domain.Messages;
using Domain.Segments;

namespace Application.Segments;

public class OnSegmentChange : INotification
{
    public Segment Segment { get; set; }

    public IEnumerable<Guid> AffectedFlagIds { get; set; }

    public OnSegmentChange(Segment segment)
    {
        Segment = segment;
        AffectedFlagIds = Array.Empty<Guid>();
    }

    public OnSegmentChange(Segment segment, IEnumerable<Guid> affectedFlagIds)
    {
        Segment = segment;
        AffectedFlagIds = affectedFlagIds;
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
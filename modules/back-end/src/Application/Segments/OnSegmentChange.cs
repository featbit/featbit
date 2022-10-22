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

    public OnSegmentChangeHandler(IMessageProducer messageProducer)
    {
        _messageProducer = messageProducer;
    }

    public async Task Handle(OnSegmentChange notification, CancellationToken cancellationToken)
    {
        // publish segment change message
        await _messageProducer.PublishAsync(Topics.SegmentChange, notification);
    }
}
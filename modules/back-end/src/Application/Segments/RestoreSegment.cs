using Application.Users;
using Domain.AuditLogs;

namespace Application.Segments;

public class RestoreSegment : IRequest<bool>
{
    public Guid Id { get; set; }
}

public class RestoreSegmentHandler : IRequestHandler<RestoreSegment, bool>
{
    private readonly ISegmentService _service;
    private readonly ICurrentUser _currentUser;
    private readonly IPublisher _publisher;

    public RestoreSegmentHandler(
        ISegmentService service,
        ICurrentUser currentUser,
        IPublisher publisher)
    {
        _service = service;
        _currentUser = currentUser;
        _publisher = publisher;
    }

    public async Task<bool> Handle(RestoreSegment request, CancellationToken cancellationToken)
    {
        var segment = await _service.GetAsync(request.Id);
        var dataChange = segment.Restore();
        await _service.UpdateAsync(segment);

        // publish on segment change notification
        var notification = new OnSegmentChange(segment, Operations.Restore, dataChange, _currentUser.Id);
        await _publisher.Publish(notification, cancellationToken);

        return true;
    }
}
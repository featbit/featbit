using Application.Users;
using Domain.AuditLogs;

namespace Application.Segments;

public class ArchiveSegment : IRequest<bool>
{
    public Guid Id { get; set; }
}

public class ArchiveSegmentHandler : IRequestHandler<ArchiveSegment, bool>
{
    private readonly ISegmentService _service;
    private readonly IPublisher _publisher;
    private readonly ICurrentUser _currentUser;

    public ArchiveSegmentHandler(
        ISegmentService service,
        IPublisher publisher,
        ICurrentUser currentUser)
    {
        _service = service;
        _publisher = publisher;
        _currentUser = currentUser;
    }

    public async Task<bool> Handle(ArchiveSegment request, CancellationToken cancellationToken)
    {
        var segment = await _service.GetAsync(request.Id);
        var dataChange = segment.Archive();
        await _service.UpdateAsync(segment);

        // publish on segment archived notification
        var notification = new OnSegmentChange(segment, Operations.Archive, dataChange, _currentUser.Id);
        await _publisher.Publish(notification, cancellationToken);

        return true;
    }
}
using Application.Bases;
using Application.Bases.Exceptions;
using Application.Users;

namespace Application.Segments;

public class DeleteSegment : IRequest<bool>
{
    public Guid EnvId { get; set; }

    public Guid Id { get; set; }
}

public class DeleteSegmentHandler : IRequestHandler<DeleteSegment, bool>
{
    private readonly ISegmentService _service;
    private readonly ICurrentUser _currentUser;
    private readonly IPublisher _publisher;

    public DeleteSegmentHandler(ISegmentService service, ICurrentUser currentUser, IPublisher publisher)
    {
        _service = service;
        _currentUser = currentUser;
        _publisher = publisher;
    }

    public async Task<bool> Handle(DeleteSegment request, CancellationToken cancellationToken)
    {
        var segment = await _service.GetAsync(request.Id);
        if (!segment.IsArchived)
        {
            throw new BusinessException(ErrorCodes.CannotDeleteUnArchivedSegment);
        }

        await _service.DeleteAsync(request.Id);

        // publish on segment change notification
        var notification = new OnSegmentDeleted(segment, _currentUser.Id);
        await _publisher.Publish(notification, cancellationToken);

        return true;
    }
}
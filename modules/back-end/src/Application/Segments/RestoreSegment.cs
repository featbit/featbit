using Application.AuditLogs;
using Application.Users;
using Domain.AuditLogs;

namespace Application.Segments;

public class RestoreSegment : ResourceChangeRequest, IRequest<bool>
{
    public Guid WorkspaceId { get; set; }

    public Guid OrgId { get; set; }

    public Guid Id { get; set; }

    public RestoreSegment(Guid workspaceId, Guid orgId, Guid id, ResourceChangeRequest payload = null)
    {
        WorkspaceId = workspaceId;
        OrgId = orgId;
        Id = id;

        Comment = payload?.Comment ?? string.Empty;
    }
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

    public async ValueTask<bool> Handle(RestoreSegment request, CancellationToken cancellationToken)
    {
        var segment = await _service.GetAsync(request.Id);
        var dataChange = segment.Restore();
        await _service.UpdateAsync(segment);

        // publish on segment change notification
        var notification = new OnSegmentChange(
            segment,
            request.WorkspaceId,
            request.OrgId,
            Operations.Restore,
            dataChange,
            _currentUser.Id,
            comment: request.Comment,
            isTargetingChange: false
        );
        await _publisher.Publish(notification, cancellationToken);

        return true;
    }
}

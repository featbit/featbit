using Application.AuditLogs;
using Application.Bases;
using Application.Bases.Exceptions;
using Application.Users;
using Domain.AuditLogs;

namespace Application.Segments;

public class ArchiveSegment : ResourceChangeRequest, IRequest<bool>
{
    public Guid WorkspaceId { get; set; }

    public Guid OrgId { get; set; }

    public Guid EnvId { get; set; }

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
        foreach (var envId in await _service.GetEnvironmentIdsAsync(segment))
        {
            if ((await _service.GetFlagReferencesAsync(envId, segment.Id)).Any())
            {
                throw new BusinessException(ErrorCodes.SegmentIsBeingUsed);
            }
        }
        var dataChange = segment.Archive();
        await _service.UpdateAsync(segment);

        // publish on segment archived notification

        var notification = new OnSegmentChange(
            segment,
            request.WorkspaceId,
            request.OrgId,
            Operations.Archive,
            dataChange,
            _currentUser.Id,
            comment: request.Comment,
            isTargetingChange: false
        );
        await _publisher.Publish(notification, cancellationToken);

        return true;
    }
}

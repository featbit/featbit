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
    private readonly IAuditLogService _auditLogService;

    public RestoreSegmentHandler(
        ISegmentService service,
        ICurrentUser currentUser,
        IPublisher publisher,
        IAuditLogService auditLogService)
    {
        _service = service;
        _currentUser = currentUser;
        _publisher = publisher;
        _auditLogService = auditLogService;
    }

    public async Task<bool> Handle(RestoreSegment request, CancellationToken cancellationToken)
    {
        var segment = await _service.GetAsync(request.Id);
        var dataChange = segment.Restore();
        await _service.UpdateAsync(segment);

        // write audit log
        var auditLog = AuditLog.ForRestore(segment, dataChange, _currentUser.Id);
        await _auditLogService.AddOneAsync(auditLog);

        // publish on segment change notification
        await _publisher.Publish(new OnSegmentChange(segment), cancellationToken);

        return true;
    }
}
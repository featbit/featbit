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
    private readonly IAuditLogService _auditLogService;

    public ArchiveSegmentHandler(
        ISegmentService service,
        IPublisher publisher,
        ICurrentUser currentUser,
        IAuditLogService auditLogService)
    {
        _service = service;
        _publisher = publisher;
        _currentUser = currentUser;
        _auditLogService = auditLogService;
    }

    public async Task<bool> Handle(ArchiveSegment request, CancellationToken cancellationToken)
    {
        var segment = await _service.GetAsync(request.Id);
        var dataChange = segment.Archive();
        await _service.UpdateAsync(segment);

        // write audit log
        var auditLog = AuditLog.ForArchive(segment, dataChange, _currentUser.Id);
        await _auditLogService.AddOneAsync(auditLog);

        // publish on segment archived notification
        await _publisher.Publish(new OnSegmentChange(segment), cancellationToken);

        return true;
    }
}
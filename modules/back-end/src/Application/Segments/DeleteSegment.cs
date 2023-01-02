using Application.Bases;
using Application.Bases.Exceptions;
using Application.Users;
using Domain.AuditLogs;

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
    private readonly IAuditLogService _auditLogService;

    public DeleteSegmentHandler(ISegmentService service, ICurrentUser currentUser, IAuditLogService auditLogService)
    {
        _service = service;
        _currentUser = currentUser;
        _auditLogService = auditLogService;
    }

    public async Task<bool> Handle(DeleteSegment request, CancellationToken cancellationToken)
    {
        var segment = await _service.GetAsync(request.Id);
        if (!segment.IsArchived)
        {
            throw new BusinessException(ErrorCodes.CannotDeleteUnArchivedSegment);
        }

        await _service.DeleteAsync(request.Id);

        // write audit log
        var auditLog = AuditLog.ForRemove(segment, _currentUser.Id);
        await _auditLogService.AddOneAsync(auditLog);

        return true;
    }
}
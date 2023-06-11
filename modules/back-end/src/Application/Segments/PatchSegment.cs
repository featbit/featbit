using Domain.AuditLogs;
using Application.Users;
using Application.Bases.Models;
using Microsoft.AspNetCore.JsonPatch;

namespace Application.Segments;

public class PatchSegment : IRequest<PatchResult>
{
    public Guid Id { get; set; }

    public JsonPatchDocument Patch { get; set; }
}

public class PatchSegmentHandler : IRequestHandler<PatchSegment, PatchResult>
{
    private readonly ISegmentService _service;
    private readonly ICurrentUser _currentUser;
    private readonly IPublisher _publisher;
    private readonly IAuditLogService _auditLogService;

    public PatchSegmentHandler(
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

    public async Task<PatchResult> Handle(PatchSegment request, CancellationToken cancellationToken)
    {
        var segment = await _service.GetAsync(request.Id);
        var dataChange = new DataChange(segment);

        var error = string.Empty;
        request.Patch.ApplyTo(segment, jsonPatchError => error = jsonPatchError.ErrorMessage);

        if (!string.IsNullOrWhiteSpace(error))
        {
            return PatchResult.Fail(error);
        }

        segment.UpdatedAt = DateTime.UtcNow;

        dataChange.To(segment);
        await _service.UpdateAsync(segment);

        // write audit log
        var auditLog = AuditLog.ForUpdate(segment, dataChange, string.Empty, _currentUser.Id);
        await _auditLogService.AddOneAsync(auditLog);

        // publish on segment change notification
        await _publisher.Publish(new OnSegmentChange(segment), cancellationToken);

        return PatchResult.Ok();
    }
}
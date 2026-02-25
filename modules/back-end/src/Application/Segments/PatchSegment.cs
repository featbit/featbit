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

    public PatchSegmentHandler(
        ISegmentService service,
        ICurrentUser currentUser,
        IPublisher publisher)
    {
        _service = service;
        _currentUser = currentUser;
        _publisher = publisher;
    }

    public async Task<PatchResult> Handle(PatchSegment request, CancellationToken cancellationToken)
    {
        var segment = await _service.GetAsync(request.Id);
        var dataChange = new DataChange(segment);

        var targetingPaths = new[] {"/included", "/excluded", "/rules"};
        var isTargetingChange = request.Patch.Operations.Any(op =>
            targetingPaths.Any(path => op.path.StartsWith(path, StringComparison.OrdinalIgnoreCase))
        );

        var error = string.Empty;
        request.Patch.ApplyTo(segment, jsonPatchError => error = jsonPatchError.ErrorMessage);

        if (!string.IsNullOrWhiteSpace(error))
        {
            return PatchResult.Fail(error);
        }

        segment.UpdatedAt = DateTime.UtcNow;

        dataChange.To(segment);
        await _service.UpdateAsync(segment);

        // publish on segment change notification
        var notification = new OnSegmentChange(
            segment,
            Operations.Update,
            dataChange,
            _currentUser.Id,
            comment: "Updated via patch",
            isTargetingChange: isTargetingChange
        );
        await _publisher.Publish(notification, cancellationToken);

        return PatchResult.Ok();
    }
}
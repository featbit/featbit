using Domain.AuditLogs;
using Application.Users;
using Application.Bases.Models;
using Domain.Policies;
using Domain.Segments;
using Microsoft.AspNetCore.JsonPatch.SystemTextJson;

namespace Application.Segments;

public class PatchSegment : IRequest<PatchResult>
{
    public Guid WorkspaceId { get; set; }

    public Guid OrgId { get; set; }

    public Guid Id { get; set; }

    public JsonPatchDocument<Segment> Patch { get; set; }

    public PolicyStatement[] Permissions { get; set; } = [];
}

public class PatchSegmentHandler(
    ISegmentService segmentService,
    IPermissionGuard permissionGuard,
    ICurrentUser currentUser,
    IPublisher publisher)
    : IRequestHandler<PatchSegment, PatchResult>
{
    public async Task<PatchResult> Handle(PatchSegment request, CancellationToken cancellationToken)
    {
        var segment = await segmentService.GetAsync(request.Id);
        var identity = (segment.Id, segment.EnvId, segment.WorkspaceId, segment.Type);
        var dataChange = new DataChange(segment);

        var targetingPaths = new[] { "/included", "/excluded", "/rules" };
        var isTargetingChange = request.Patch.Operations.Any(op =>
            targetingPaths.Any(path => op.path.StartsWith(path, StringComparison.OrdinalIgnoreCase))
        );

        var error = string.Empty;
        request.Patch.ApplyTo(segment, jsonPatchError => error = jsonPatchError.ErrorMessage);

        if (!string.IsNullOrWhiteSpace(error))
        {
            return PatchResult.Fail(error);
        }

        if ((segment.Id, segment.EnvId, segment.WorkspaceId, segment.Type) != identity)
            return PatchResult.Fail("Segment identity, environment, workspace and type cannot be changed by a patch.");

        segment.MarkAsUpdated(currentUser.Id);
        dataChange.To(segment);

        await permissionGuard.EnsureSegmentChangeAllowedAsync(segment, dataChange, request.Permissions);

        await segmentService.UpdateAsync(segment);

        // publish on segment change notification
        var notification = new OnSegmentChange(
            segment,
            request.WorkspaceId,
            request.OrgId,
            Operations.Update,
            dataChange,
            currentUser.Id,
            comment: "Updated via patch",
            isTargetingChange: isTargetingChange
        );
        await publisher.Publish(notification, cancellationToken);

        return PatchResult.Ok();
    }
}

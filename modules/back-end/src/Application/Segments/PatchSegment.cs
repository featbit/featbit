using Application.Bases.Exceptions;
using Domain.AuditLogs;
using Application.Users;
using Application.Bases.Models;
using Domain.Policies;
using Domain.Segments;
using Domain.SemanticPatch;
using Microsoft.AspNetCore.JsonPatch.SystemTextJson;

namespace Application.Segments;

public class PatchSegment : IRequest<PatchResult>
{
    public Guid Id { get; set; }

    public JsonPatchDocument<Segment> Patch { get; set; }

    public PolicyStatement[] Permissions { get; set; } = [];
}

public class PatchSegmentHandler(
    ISegmentService segmentService,
    IResourceService resourceService,
    ICurrentUser currentUser,
    IPublisher publisher)
    : IRequestHandler<PatchSegment, PatchResult>
{
    public async Task<PatchResult> Handle(PatchSegment request, CancellationToken cancellationToken)
    {
        var segment = await segmentService.GetAsync(request.Id);
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

        segment.MarkAsUpdated(currentUser.Id);
        dataChange.To(segment);

        await CheckPermissionsAsync();

        await segmentService.UpdateAsync(segment);

        // publish on segment change notification
        var notification = new OnSegmentChange(
            segment,
            Operations.Update,
            dataChange,
            currentUser.Id,
            comment: "Updated via patch",
            isTargetingChange: isTargetingChange
        );
        await publisher.Publish(notification, cancellationToken);

        return PatchResult.Ok();

        async Task CheckPermissionsAsync()
        {
            var instructions = SegmentComparer.Compare(dataChange).ToArray();
            var requiredPermissions = instructions
                .Select(x => x.Permission)
                .Where(permission => !string.IsNullOrEmpty(permission))
                .ToHashSet();

            if (requiredPermissions.Count == 0)
            {
                return;
            }

            var rn = await resourceService.GetSegmentRnAsync(segment.EnvId, segment.Id);
            if (requiredPermissions.Any(permission => !PolicyHelper.IsAllowed(request.Permissions, rn, permission)))
            {
                throw new ForbiddenException();
            }
        }
    }
}
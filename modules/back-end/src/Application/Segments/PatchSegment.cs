using Domain.AuditLogs;
using Application.Users;
using Application.Bases;
using Application.Bases.Models;
using Domain.Policies;
using Domain.Segments;
using Microsoft.AspNetCore.JsonPatch.SystemTextJson;
using Microsoft.AspNetCore.JsonPatch.SystemTextJson.Operations;

namespace Application.Segments;

public class PatchSegment : IRequest<PatchResult>
{
    public Guid WorkspaceId { get; set; }

    public Guid OrgId { get; set; }

    public Guid EnvId { get; set; }

    public Guid Id { get; set; }

    public JsonPatchDocument<Segment> Patch { get; set; }

    public PolicyStatement[] Permissions { get; set; } = [];
}

public class PatchSegmentValidator : AbstractValidator<PatchSegment>
{
    // Only business fields understood by SegmentComparer may be written. New entity fields
    // must be explicitly reviewed before becoming part of the public patch API.
    private static readonly HashSet<string> WritableFields = new(StringComparer.OrdinalIgnoreCase)
    {
        nameof(Segment.Name), nameof(Segment.Description), nameof(Segment.Tags),
        nameof(Segment.Included), nameof(Segment.Excluded), nameof(Segment.Rules),
        nameof(Segment.IsArchived)
    };

    public PatchSegmentValidator()
    {
        RuleFor(x => x.Patch)
            .NotNull().WithErrorCode(ErrorCodes.Required("patch"));

        // Validate all paths, including test operations, before the handler applies any operation;
        // move also requires a writable source because it removes the source value.
        When(x => x.Patch != null, () =>
        {
            RuleForEach(x => x.Patch.Operations).ChildRules(operation =>
            {
                operation.RuleFor(x => x.path)
                    .Must(IsWritablePath)
                    .WithMessage("The path '{PropertyValue}' cannot be used by a segment patch.")
                    .WithErrorCode(ErrorCodes.Invalid("path"));

                operation.RuleFor(x => x.from)
                    .Must((op, from) => op.OperationType != OperationType.Move ||
                        IsWritablePath(from))
                    .WithMessage("The source path '{PropertyValue}' cannot be used by a segment patch.")
                    .WithErrorCode(ErrorCodes.Invalid("from"));
            });
        });
    }

    private static bool IsWritablePath(string path)
    {
        if (string.IsNullOrEmpty(path) || path[0] != '/')
        {
            return false;
        }

        var field = path.Split('/')[1];
        return WritableFields.Contains(field);
    }
}

public class PatchSegmentHandler(
    ISegmentService segmentService,
    SegmentPermissionGuard segmentGuard,
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

        await segmentGuard.EnsureChangeAllowedAsync(request.OrgId, request.EnvId, segment.Id, dataChange, request.Permissions);

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

using Application.AuditLogs;
using Application.Bases;
using Application.Users;
using Domain.AuditLogs;
using Domain.Policies;

namespace Application.Segments;

public class UpdateGeneralPayload : ResourceChangeRequest
{
    /// <summary>
    /// The new name for the segment.
    /// </summary>
    public string Name { get; set; }

    /// <summary>
    /// The new description for the segment.
    /// </summary>
    public string Description { get; set; }

    /// <summary>
    /// The collection of tags to set for the segment.
    /// </summary>
    public string[] Tags { get; set; }
}

public class UpdateGeneral : UpdateGeneralPayload, IRequest<bool>
{
    public Guid Id { get; set; }

    public PolicyStatement[] Permissions { get; set; }

    public UpdateGeneral(
        Guid segmentId,
        UpdateGeneralPayload payload,
        PolicyStatement[] permissions)
    {
        Id = segmentId;
        Name = payload.Name;
        Description = payload.Description;
        Tags = payload.Tags;
        Comment = payload.Comment;
        Permissions = permissions;
    }
}

public class UpdateGeneralValidator : AbstractValidator<UpdateGeneral>
{
    public UpdateGeneralValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("name"))
            .MaximumLength(128).WithErrorCode(ErrorCodes.Invalid("name"));
    }
}

public class UpdateGeneralHandler(
    ISegmentService service,
    IPermissionGuard permissionGuard,
    ICurrentUser currentUser,
    IPublisher publisher)
    : IRequestHandler<UpdateGeneral, bool>
{
    public async Task<bool> Handle(UpdateGeneral request, CancellationToken cancellationToken)
    {
        var segment = await service.GetAsync(request.Id);
        var requestedTags = request.Tags ?? [];
        var currentTags = segment.Tags ?? [];

        var nameChanged = segment.Name != request.Name;
        var descriptionChanged = segment.Description != request.Description;
        var tagsChanged = !currentTags.ToHashSet().SetEquals(requestedTags);

        if (!nameChanged && !descriptionChanged && !tagsChanged)
        {
            return true;
        }

        var dataChange = segment.UpdateGeneral(
            request.Name,
            request.Description,
            tagsChanged ? requestedTags : currentTags
        );
        await permissionGuard.EnsureSegmentChangeAllowedAsync(segment, dataChange, request.Permissions);
        await service.UpdateAsync(segment);

        var notification = new OnSegmentChange(
            segment,
            Operations.Update,
            dataChange,
            currentUser.Id,
            comment: request.Comment,
            isTargetingChange: false);
        await publisher.Publish(notification, cancellationToken);

        return true;
    }
}

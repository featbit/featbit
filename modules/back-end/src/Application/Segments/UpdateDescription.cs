using Application.AuditLogs;
using Application.Users;
using Domain.AuditLogs;

namespace Application.Segments;

public class UpdateDescriptionPayload : ResourceChangeRequest
{
    /// <summary>
    /// The new description for the segment.
    /// </summary>
    public string Description { get; set; }
}

public class UpdateDescription : UpdateDescriptionPayload, IRequest<bool>
{
    public Guid WorkspaceId { get; set; }

    public Guid OrgId { get; set; }

    public Guid Id { get; set; }

    public UpdateDescription(Guid workspaceId, Guid orgId, Guid id, UpdateDescriptionPayload payload)
    {
        WorkspaceId = workspaceId;
        OrgId = orgId;
        Id = id;

        Description = payload.Description;
        Comment = payload.Comment;
    }
}

public class UpdateDescriptionHandler(
    ISegmentService service,
    ICurrentUser currentUser,
    IPublisher publisher
) : IRequestHandler<UpdateDescription, bool>
{
    public async ValueTask<bool> Handle(UpdateDescription request, CancellationToken cancellationToken)
    {
        var segment = await service.GetAsync(request.Id);
        var dataChange = segment.UpdateDescription(request.Description);
        await service.UpdateAsync(segment);

        // publish on segment change notification
        var notification = new OnSegmentChange(
            segment,
            request.WorkspaceId,
            request.OrgId,
            Operations.Update,
            dataChange,
            currentUser.Id,
            comment: request.Comment,
            isTargetingChange: false
        );
        await publisher.Publish(notification, cancellationToken);

        return true;
    }
}

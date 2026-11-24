using Application.AuditLogs;
using Application.Users;
using Domain.AuditLogs;

namespace Application.Segments;

public class SetTagsPayload : ResourceChangeRequest
{
    /// <summary>
    /// The collection of tags to set for the segment. Tags are used for categorization and filtering of segments.
    /// </summary>
    public string[] Tags { get; set; }
}

public class SetTags : SetTagsPayload, IRequest<bool>
{
    public Guid WorkspaceId { get; set; }

    public Guid OrgId { get; set; }

    public Guid Id { get; set; }

    public SetTags(Guid workspaceId, Guid orgId, Guid id, SetTagsPayload payload)
    {
        WorkspaceId = workspaceId;
        OrgId = orgId;
        Id = id;

        Tags = payload.Tags;
        Comment = payload.Comment;
    }
}

public class SetTagsHandler(ISegmentService service, ICurrentUser currentUser, IPublisher publisher)
    : IRequestHandler<SetTags, bool>
{
    public async Task<bool> Handle(SetTags request, CancellationToken cancellationToken)
    {
        var segment = await service.GetAsync(request.Id);
        var dataChange = segment.SetTags(request.Tags);
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

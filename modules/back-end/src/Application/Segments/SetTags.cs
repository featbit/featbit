using Application.AuditLogs;
using Application.Users;
using Domain.AuditLogs;

namespace Application.Segments;

public class SetTags : ResourceChangeRequest, IRequest<bool>
{
    /// <summary>
    /// The ID of the segment to set tags for. Retrieved from the URL path.
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// The collection of tags to set for the segment. Tags are used for categorization and filtering of segments.
    /// </summary>
    public string[] Tags { get; set; }
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
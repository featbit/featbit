using Application.Users;
using Domain.AuditLogs;

namespace Application.Segments;

public class SetTags : IRequest<bool>
{
    public Guid Id { get; set; }

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

        // publish on feature flag change notification
        var notification = new OnSegmentChange(segment, Operations.Update, dataChange, currentUser.Id);
        await publisher.Publish(notification, cancellationToken);

        return true;
    }
}
using Application.Users;
using Domain.AuditLogs;

namespace Application.Segments;

public class UpdateDescription : IRequest<bool>
{
    /// <summary>
    /// The ID of the segment to update. Retrieved from the URL path.
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// The new description for the segment.
    /// </summary>
    public string Description { get; set; }
}

public class UpdateDescriptionHandler(
    ISegmentService service,
    ICurrentUser currentUser,
    IPublisher publisher
) : IRequestHandler<UpdateDescription, bool>
{
    public async Task<bool> Handle(UpdateDescription request, CancellationToken cancellationToken)
    {
        var segment = await service.GetAsync(request.Id);
        var dataChange = segment.UpdateDescription(request.Description);
        await service.UpdateAsync(segment);

        // publish on segment change notification
        var notification = new OnSegmentChange(
            segment,
            Operations.Update,
            dataChange,
            currentUser.Id,
            comment: "Updated description",
            isTargetingChange: false
        );
        await publisher.Publish(notification, cancellationToken);

        return true;
    }
}

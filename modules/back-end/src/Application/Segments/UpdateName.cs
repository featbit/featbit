using Application.Bases;
using Application.Users;
using Domain.AuditLogs;

namespace Application.Segments;

public class UpdateName : IRequest<bool>
{
    /// <summary>
    /// The ID of the segment to update. Retrieved from the URL path.
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// The new name for the segment.
    /// </summary>
    public string Name { get; set; }
}

public class UpdateNameValidator : AbstractValidator<UpdateName>
{
    public UpdateNameValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithErrorCode(ErrorCodes.Required("name"));
    }
}

public class UpdateNameHandler(
    ISegmentService service,
    ICurrentUser currentUser,
    IPublisher publisher
) : IRequestHandler<UpdateName, bool>
{
    public async Task<bool> Handle(UpdateName request, CancellationToken cancellationToken)
    {
        var segment = await service.GetAsync(request.Id);
        var dataChange = segment.UpdateName(request.Name);
        await service.UpdateAsync(segment);

        // publish on segment change notification
        var notification = new OnSegmentChange(
            segment,
            Operations.Update,
            dataChange,
            currentUser.Id,
            comment: "Updated name",
            isTargetingChange: false
        );
        await publisher.Publish(notification, cancellationToken);

        return true;
    }
}

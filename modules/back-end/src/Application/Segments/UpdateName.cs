using Application.AuditLogs;
using Application.Bases;
using Application.Users;
using Domain.AuditLogs;

namespace Application.Segments;

public class UpdateNamePayload : ResourceChangeRequest
{
    /// <summary>
    /// The new name for the segment.
    /// </summary>
    public string Name { get; set; }
}

public class UpdateName : UpdateNamePayload, IRequest<bool>
{
    public Guid WorkspaceId { get; set; }

    public Guid OrgId { get; set; }

    public Guid Id { get; set; }

    public UpdateName(Guid workspaceId, Guid orgId, Guid id, UpdateNamePayload payload)
    {
        WorkspaceId = workspaceId;
        OrgId = orgId;
        Id = id;

        Name = payload.Name;
        Comment = payload.Comment;
    }
}

public class UpdateNameValidator : AbstractValidator<UpdateName>
{
    public UpdateNameValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("name"))
            .MaximumLength(128).WithErrorCode(ErrorCodes.Invalid("name"));
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

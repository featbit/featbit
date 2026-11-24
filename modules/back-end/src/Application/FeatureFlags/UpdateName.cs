using Application.AuditLogs;
using Application.Bases;
using Application.Users;
using Domain.AuditLogs;

namespace Application.FeatureFlags;

public class UpdateNamePayload : ResourceChangeRequest
{
    /// <summary>
    /// The new name for the feature flag
    /// </summary>
    public string Name { get; set; }
}

public class UpdateName : UpdateNamePayload, IRequest<Guid>
{
    public Guid WorkspaceId { get; set; }

    public Guid OrgId { get; set; }

    public Guid EnvId { get; set; }

    public string Key { get; set; }

    public UpdateName(Guid workspaceId, Guid orgId, Guid envId, string key, UpdateNamePayload payload)
    {
        WorkspaceId = workspaceId;
        OrgId = orgId;
        EnvId = envId;
        Key = key;

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
    IFeatureFlagService service,
    ICurrentUser currentUser,
    IPublisher publisher)
    : IRequestHandler<UpdateName, Guid>
{
    public async Task<Guid> Handle(UpdateName request, CancellationToken cancellationToken)
    {
        var flag = await service.GetAsync(request.EnvId, request.Key);
        if (flag.Name == request.Name)
        {
            return flag.Revision;
        }

        var dataChange = flag.UpdateName(request.Name, currentUser.Id);
        await service.UpdateAsync(flag);

        // publish on feature flag change notification
        var notification = new OnFeatureFlagChanged(
            flag,
            request.WorkspaceId,
            request.OrgId,
            Operations.Update,
            dataChange,
            currentUser.Id,
            comment: request.Comment
        );
        await publisher.Publish(notification, cancellationToken);

        return flag.Revision;
    }
}

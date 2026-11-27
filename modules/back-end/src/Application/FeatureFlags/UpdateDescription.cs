using Application.AuditLogs;
using Application.Users;
using Domain.AuditLogs;

namespace Application.FeatureFlags;

public class UpdateDescriptionPayload : ResourceChangeRequest
{
    /// <summary>
    /// The new description for the feature flag
    /// </summary>
    public string Description { get; set; }
}

public class UpdateDescription : UpdateDescriptionPayload, IRequest<Guid>
{
    public Guid WorkspaceId { get; set; }

    public Guid OrgId { get; set; }

    public Guid EnvId { get; set; }

    public string Key { get; set; }

    public UpdateDescription(Guid workspaceId, Guid orgId, Guid envId, string key, UpdateDescriptionPayload payload)
    {
        WorkspaceId = workspaceId;
        OrgId = orgId;
        EnvId = envId;
        Key = key;

        Description = payload.Description;
        Comment = payload.Comment;
    }
}

public class UpdateDescriptionHandler(
    IFeatureFlagService service,
    ICurrentUser currentUser,
    IPublisher publisher)
    : IRequestHandler<UpdateDescription, Guid>
{
    public async ValueTask<Guid> Handle(UpdateDescription request, CancellationToken cancellationToken)
    {
        var flag = await service.GetAsync(request.EnvId, request.Key);
        if (flag.Description == request.Description)
        {
            return flag.Revision;
        }

        var dataChange = flag.UpdateDescription(request.Description, currentUser.Id);
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

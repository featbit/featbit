using Application.AuditLogs;
using Application.Users;
using Domain.AuditLogs;

namespace Application.FeatureFlags;

public class SetTagsPayload : ResourceChangeRequest
{
    /// <summary>
    /// The collection of tags to set for the feature flag. Tags are used for categorization and filtering of feature flags.
    /// </summary>
    public string[] Tags { get; set; }
}

public class SetTags : SetTagsPayload, IRequest<bool>
{
    public Guid WorkspaceId { get; set; }

    public Guid OrgId { get; set; }

    public Guid EnvId { get; set; }

    public string Key { get; set; }

    public SetTags(Guid workspaceId, Guid orgId, Guid envId, string key, SetTagsPayload payload)
    {
        WorkspaceId = workspaceId;
        OrgId = orgId;
        EnvId = envId;
        Key = key;

        Tags = payload.Tags;
        Comment = payload.Comment;
    }
}

public class SetTagsHandler(IFeatureFlagService service, ICurrentUser currentUser, IPublisher publisher)
    : IRequestHandler<SetTags, bool>
{
    public async Task<bool> Handle(SetTags request, CancellationToken cancellationToken)
    {
        var flag = await service.GetAsync(request.EnvId, request.Key);
        var dataChange = flag.SetTags(request.Tags, currentUser.Id);
        await service.UpdateAsync(flag);

        // publish on feature flag change notification
        var notification =
            new OnFeatureFlagChanged(flag, request.WorkspaceId, request.OrgId, Operations.Update, dataChange, currentUser.Id, request.Comment);
        await publisher.Publish(notification, cancellationToken);

        return true;
    }
}

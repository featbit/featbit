using Application.AuditLogs;
using Application.Users;
using Domain.AuditLogs;

namespace Application.FeatureFlags;

public class SetTags : ResourceChangeRequest, IRequest<bool>
{
    /// <summary>
    /// The ID of the environment the feature flag belongs to. Retrieved from the URL path.
    /// </summary>
    public Guid EnvId { get; set; }

    /// <summary>
    /// The unique key of the feature flag. Retrieved from the URL path.
    /// </summary>
    public string Key { get; set; }

    /// <summary>
    /// The collection of tags to set for the feature flag. Tags are used for categorization and filtering of feature flags.
    /// </summary>
    public string[] Tags { get; set; }
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
            new OnFeatureFlagChanged(flag, Operations.Update, dataChange, currentUser.Id, request.Comment);
        await publisher.Publish(notification, cancellationToken);

        return true;
    }
}
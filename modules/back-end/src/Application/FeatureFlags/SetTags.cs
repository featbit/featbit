using Application.Users;
using Domain.AuditLogs;

namespace Application.FeatureFlags;

public class SetTags : IRequest<bool>
{
    public Guid EnvId { get; set; }

    public string Key { get; set; }

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
        var notification = new OnFeatureFlagChanged(flag, Operations.Update, dataChange, currentUser.Id);
        await publisher.Publish(notification, cancellationToken);

        return true;
    }
}
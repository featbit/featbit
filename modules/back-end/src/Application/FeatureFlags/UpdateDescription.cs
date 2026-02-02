using Application.Users;
using Domain.AuditLogs;

namespace Application.FeatureFlags;

public class UpdateDescription : IRequest<bool>
{
    public Guid EnvId { get; set; }

    public string Key { get; set; }

    public string Description { get; set; }
}

public class UpdateDescriptionHandler(
    IFeatureFlagService service,
    ICurrentUser currentUser,
    IPublisher publisher)
    : IRequestHandler<UpdateDescription, bool>
{
    public async Task<bool> Handle(UpdateDescription request, CancellationToken cancellationToken)
    {
        var flag = await service.GetAsync(request.EnvId, request.Key);
        var dataChange = flag.UpdateDescription(request.Description, currentUser.Id);
        await service.UpdateAsync(flag);

        // publish on feature flag change notification
        var notification = new OnFeatureFlagChanged(
            flag,
            Operations.Update,
            dataChange,
            currentUser.Id,
            comment: "Updated description"
        );
        await publisher.Publish(notification, cancellationToken);

        return true;
    }
}
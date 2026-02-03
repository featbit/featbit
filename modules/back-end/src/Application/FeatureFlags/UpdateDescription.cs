using Application.Users;
using Domain.AuditLogs;

namespace Application.FeatureFlags;

public class UpdateDescription : IRequest<Guid>
{
    public Guid EnvId { get; set; }

    public string Key { get; set; }

    public string Description { get; set; }
}

public class UpdateDescriptionHandler(
    IFeatureFlagService service,
    ICurrentUser currentUser,
    IPublisher publisher)
    : IRequestHandler<UpdateDescription, Guid>
{
    public async Task<Guid> Handle(UpdateDescription request, CancellationToken cancellationToken)
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
            Operations.Update,
            dataChange,
            currentUser.Id,
            comment: "Updated description"
        );
        await publisher.Publish(notification, cancellationToken);

        return flag.Revision;
    }
}
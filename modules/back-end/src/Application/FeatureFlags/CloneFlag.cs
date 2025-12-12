using Application.Bases;
using Application.Bases.Exceptions;
using Application.Users;
using Domain.AuditLogs;

namespace Application.FeatureFlags;

public class CloneFlag : IRequest<bool>
{
    public Guid EnvId { get; set; }

    public string OriginFlagKey { get; set; }

    public string Name { get; set; }

    public string Key { get; set; }

    public string Description { get; set; }

    public string[] Tags { get; set; }
}

public class CloneFlagHandler(
    IFeatureFlagService flagService,
    ICurrentUser currentUser,
    IPublisher publisher)
    : IRequestHandler<CloneFlag, bool>
{
    public async Task<bool> Handle(CloneFlag request, CancellationToken cancellationToken)
    {
        var hasKeyBeenUsed = await flagService.HasKeyBeenUsedAsync(request.EnvId, request.Key);
        if (hasKeyBeenUsed)
        {
            throw new BusinessException(ErrorCodes.KeyHasBeenUsed);
        }

        var flagToClone = await flagService.GetAsync(request.EnvId, request.OriginFlagKey);

        var clonedFlag = flagToClone.Clone(request.Name, request.Key, request.Description, request.Tags, currentUser.Id);
        await flagService.AddOneAsync(clonedFlag);

        // publish on feature flag change notification
        var dataChange = new DataChange(null).To(clonedFlag);
        var notification = new OnFeatureFlagChanged(clonedFlag, Operations.Create, dataChange, currentUser.Id);
        await publisher.Publish(notification, cancellationToken);

        return true;
    }
}
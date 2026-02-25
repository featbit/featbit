using Application.Bases;
using Application.Bases.Exceptions;
using Application.Users;
using Domain.AuditLogs;

namespace Application.FeatureFlags;

public class CloneFlag : IRequest<bool>
{
    /// <summary>
    /// The ID of the environment the feature flag belongs to. Retrieved from the URL path.
    /// </summary>
    public Guid EnvId { get; set; }

    /// <summary>
    /// The unique key of the feature flag to clone from. Retrieved from the URL path.
    /// </summary>
    public string OriginFlagKey { get; set; }

    /// <summary>
    /// The name for the cloned feature flag
    /// </summary>
    public string Name { get; set; }

    /// <summary>
    /// The unique key for the cloned feature flag
    /// </summary>
    public string Key { get; set; }

    /// <summary>
    /// The description for the cloned feature flag
    /// </summary>
    public string Description { get; set; }

    /// <summary>
    /// The tags to assign to the cloned feature flag
    /// </summary>
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
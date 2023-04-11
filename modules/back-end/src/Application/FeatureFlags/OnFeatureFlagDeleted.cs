using Application.Caches;

namespace Application.FeatureFlags;

public class OnFeatureFlagDeleted : INotification
{
    public Guid EnvId { get; set; }

    public Guid FlagId { get; set; }

    public OnFeatureFlagDeleted(Guid envId, Guid flagId)
    {
        EnvId = envId;
        FlagId = flagId;
    }
}

public class OnFeatureFlagDeletedHandler : INotificationHandler<OnFeatureFlagDeleted>
{
    private readonly ICacheService _cache;

    public OnFeatureFlagDeletedHandler(ICacheService cache)
    {
        _cache = cache;
    }

    public async Task Handle(OnFeatureFlagDeleted notification, CancellationToken cancellationToken)
    {
        // delete cache
        await _cache.DeleteFlagAsync(notification.EnvId, notification.FlagId);
    }
}
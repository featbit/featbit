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
    private readonly IRedisService _service;

    public OnFeatureFlagDeletedHandler(IRedisService service)
    {
        _service = service;
    }

    public async Task Handle(OnFeatureFlagDeleted notification, CancellationToken cancellationToken)
    {
        await _service.DeleteFlagAsync(notification.EnvId, notification.FlagId);
    }
}
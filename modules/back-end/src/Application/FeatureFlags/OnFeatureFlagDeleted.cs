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
    public Task Handle(OnFeatureFlagDeleted notification, CancellationToken cancellationToken)
    {
        return Task.CompletedTask;
    }
}
using Domain.FeatureFlags;
using Domain.Messages;

namespace Application.FeatureFlags;

public class OnFeatureFlagChanged : INotification
{
    public FeatureFlag Flag { get; set; }

    public OnFeatureFlagChanged(FeatureFlag flag)
    {
        Flag = flag;
    }
}

public class OnFeatureFlagChangedHandler : INotificationHandler<OnFeatureFlagChanged>
{
    private readonly IMessageProducer _messageProducer;

    public OnFeatureFlagChangedHandler(IMessageProducer messageProducer)
    {
        _messageProducer = messageProducer;
    }

    public async Task Handle(OnFeatureFlagChanged notification, CancellationToken cancellationToken)
    {
        // publish feature flag change message
        await _messageProducer.PublishAsync(Topics.FeatureFlagChange, notification.Flag);
    }
}
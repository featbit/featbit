using Application.Caches;
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
    private readonly ICacheService _cache;

    public OnFeatureFlagChangedHandler(IMessageProducer messageProducer, ICacheService cache)
    {
        _messageProducer = messageProducer;
        _cache = cache;
    }

    public async Task Handle(OnFeatureFlagChanged notification, CancellationToken cancellationToken)
    {
        var flag = notification.Flag;

        // update cache
        await _cache.UpsertFlagAsync(flag);

        // publish feature flag change message
        await _messageProducer.PublishAsync(Topics.FeatureFlagChange, flag);
    }
}
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
    private readonly IRedisService _redisService;
    private readonly IMessageProducer _messageProducer;

    public OnFeatureFlagChangedHandler(IRedisService redisService, IMessageProducer messageProducer)
    {
        _redisService = redisService;
        _messageProducer = messageProducer;
    }

    public async Task Handle(OnFeatureFlagChanged notification, CancellationToken cancellationToken)
    {
        var flag = notification.Flag;

        // upsert feature flag cache
        await _redisService.UpsertFlagAsync(flag);

        // publish feature flag change message
        await _messageProducer.PublishAsync(Topics.FeatureFlagChange, flag);
    }
}
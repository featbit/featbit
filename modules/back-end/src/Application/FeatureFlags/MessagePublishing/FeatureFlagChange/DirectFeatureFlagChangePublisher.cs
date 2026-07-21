using Domain.Messages;

namespace Application.FeatureFlags.MessagePublishing.FeatureFlagChange;

public class DirectFeatureFlagChangePublisher(IMessageProducer messageProducer) : IFeatureFlagChangePublisher
{
    public async Task PublishAsync(OnFeatureFlagChanged notification)
    {
        await messageProducer.PublishAsync(Topics.FeatureFlagChange, notification.Flag);
    }
}
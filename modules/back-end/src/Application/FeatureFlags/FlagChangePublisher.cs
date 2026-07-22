using Domain.Messages;
using Microsoft.Extensions.Configuration;

namespace Application.FeatureFlags;

public interface IFeatureFlagChangePublisher
{
    Task PublishAsync(OnFeatureFlagChanged notification);
}

public class DirectFeatureFlagChangePublisher(IMessageProducer messageProducer) : IFeatureFlagChangePublisher
{
    public async Task PublishAsync(OnFeatureFlagChanged notification)
    {
        await messageProducer.PublishAsync(Topics.FeatureFlagChange, notification.Flag);
    }
}

public class ControlPlaneFeatureFlagChangePublisher(IMessageProducer messageProducer, IConfiguration configuration)
    : IFeatureFlagChangePublisher
{
    public async Task PublishAsync(OnFeatureFlagChanged notification)
    {
        var message = new
        {
            notification,
            region = configuration.GetRegion()
        };

        await messageProducer.PublishAsync(ControlPlaneTopics.ControlPlaneFeatureFlagChange, message);
    }
}
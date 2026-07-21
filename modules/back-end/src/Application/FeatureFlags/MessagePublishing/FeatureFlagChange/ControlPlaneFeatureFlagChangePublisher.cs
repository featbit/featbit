using Domain.Messages;
using Microsoft.Extensions.Configuration;

namespace Application.FeatureFlags.MessagePublishing.FeatureFlagChange;

public class ControlPlaneFeatureFlagChangePublisher(IMessageProducer messageProducer, IConfiguration configuration) : IFeatureFlagChangePublisher
{
    public async Task PublishAsync(OnFeatureFlagChanged notification)
    {
        var flagMessage = new { notification, region = configuration.GetRegion() };
        await messageProducer.PublishAsync(ControlPlaneTopics.ControlPlaneFeatureFlagChange, flagMessage);
    }
}
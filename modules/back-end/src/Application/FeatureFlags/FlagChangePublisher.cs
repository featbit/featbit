using Domain.Messages;
using Microsoft.Extensions.Configuration;

namespace Application.FeatureFlags;

public interface IFeatureFlagChangePublisher
{
    /// <summary>
    /// Publishes a feature flag change message.
    /// </summary>
    Task PublishAsync(OnFeatureFlagChanged notification);

    /// <summary>
    /// Publishes a feature flag deletion message.
    /// </summary>
    Task PublishDeletedAsync(Guid envId, Guid flagId);
}

public class DirectFeatureFlagChangePublisher(IMessageProducer messageProducer) : IFeatureFlagChangePublisher
{
    public async Task PublishAsync(OnFeatureFlagChanged notification)
    {
        await messageProducer.PublishAsync(Topics.FeatureFlagChange, notification.Flag);
    }

    // no-op for now
    public Task PublishDeletedAsync(Guid envId, Guid flagId) => Task.CompletedTask;
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

    // Sent on the same topic as the change. The "deleted" shape has no "notification", so a control plane that
    // does not know it rejects the message instead of treating it as a change.
    public async Task PublishDeletedAsync(Guid envId, Guid flagId)
    {
        var message = new
        {
            deleted = new { envId, id = flagId },
            region = configuration.GetRegion()
        };

        await messageProducer.PublishAsync(ControlPlaneTopics.ControlPlaneFeatureFlagChange, message);
    }
}

namespace Application.FeatureFlags.MessagePublishing.FeatureFlagChange;

public interface IFeatureFlagChangePublisher
{
    Task PublishAsync(OnFeatureFlagChanged notification);
}
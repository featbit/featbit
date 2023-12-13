using Application.FeatureFlags;

namespace Application.Services;

public interface IWebhookHandler
{
    Task HandleAsync(OnFeatureFlagChanged notification);
}
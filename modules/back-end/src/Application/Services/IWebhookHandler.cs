using Application.FeatureFlags;
using Application.Segments;

namespace Application.Services;

public interface IWebhookHandler
{
    Task HandleAsync(OnFeatureFlagChanged notification);

    Task HandleAsync(OnSegmentChange notification);
}
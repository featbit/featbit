namespace Domain.Webhooks;

public static class WebhookEvents
{
    // feature flag
    public const string FeatureFlagCreate = "feature_flag.create";

    // segment
    public const string SegmentCreate = "segment.create";

    public static readonly string[] All = { FeatureFlagCreate, SegmentCreate };
}
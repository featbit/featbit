namespace Domain.Messages;

public static class Topics
{
    public const string EndUser = "featbit-endusers";

    public const string FeatureFlagChange = "featbit-feature-flag-change";

    public const string SegmentChange = "featbit-segment-change";

    public const string Insights = "featbit-insights";

    public static string ToChannel(string topic) => topic switch
    {
        FeatureFlagChange => "featbit_feature_flag_change_channel",
        SegmentChange => "featbit_segment_change_channel",
        _ => throw new ArgumentOutOfRangeException(nameof(topic), topic, "Unsupported topic")
    };
}
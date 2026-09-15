namespace Domain.Messages;

public static class Topics
{
    public const string EndUser = "featbit-endusers";

    public const string FeatureFlagChange = "featbit-feature-flag-change";

    public const string SegmentChange = "featbit-segment-change";

    public const string Insights = "featbit-insights";

    public const string Usage = "featbit-usage";

    public static string ToChannel(string topic) => topic switch
    {
        FeatureFlagChange => FeatureFlagChangeChannel,
        SegmentChange => SegmentChangeChannel,
        ControlPlaneTopics.ControlPlaneCommand => ControlPlaneCommandChannel,
        _ => throw new ArgumentOutOfRangeException(nameof(topic), topic, "Unsupported topic")
    };

    // These literals are a cross-module contract: the evaluation server's PostgresMessageConsumer
    // issues LISTEN on exactly these names (its own Domain.Messages.Topics.ToChannel). The two
    // modules cannot reference each other, so the strings must be kept identical by hand and are
    // pinned by tests on both sides.
    private const string FeatureFlagChangeChannel = "featbit_feature_flag_change_channel";
    private const string SegmentChangeChannel = "featbit_segment_change_channel";
    private const string ControlPlaneCommandChannel = "featbit_control_plane_command_channel";
}
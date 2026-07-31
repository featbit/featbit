namespace Domain.Messages;

public static class Topics
{
    public const string EndUser = "featbit-endusers";

    // This pattern **must** cover FeatureFlagChange & SegmentChange
    public const string DataChangePattern = "featbit-*-change";
    public const string FeatureFlagChange = "featbit-feature-flag-change";
    public const string SegmentChange = "featbit-segment-change";

    public const string ControlPlaneCommand = "featbit-control-plane-command";

    public const string Insights = "featbit-insights";
    public const string Usage = "featbit-usage";

    public const string ConnectionMade = "featbit-connection-made";
    public const string ConnectionClosed = "featbit-connection-closed";
    public const string PodHeartbeat = "featbit-pod-heartbeat";

    public static string ToChannel(string topic) => topic switch
    {
        FeatureFlagChange => "featbit_feature_flag_change_channel",
        SegmentChange => "featbit_segment_change_channel",
        ControlPlaneCommand => "featbit_control_plane_command_channel",
        _ => throw new ArgumentOutOfRangeException(nameof(topic), topic, "Unsupported topic")
    };
}
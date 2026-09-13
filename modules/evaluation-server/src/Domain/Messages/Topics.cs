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
        FeatureFlagChange => FeatureFlagChangeChannel,
        SegmentChange => SegmentChangeChannel,
        ControlPlaneCommand => ControlPlaneCommandChannel,
        _ => throw new ArgumentOutOfRangeException(nameof(topic), topic, "Unsupported topic")
    };

    /// <summary>
    /// Inverse of <see cref="ToChannel"/>, used to report the canonical topic name on telemetry so
    /// that a consumer's <c>destination</c> matches the producer's instead of carrying the physical
    /// <c>LISTEN</c>/<c>NOTIFY</c> channel name.
    /// </summary>
    /// <remarks>
    /// Unlike <see cref="ToChannel"/> this never throws. An unrecognised channel is returned
    /// unchanged, so a notification with no registered handler is still recorded as unroutable
    /// rather than throwing on the consume path — instrumentation must not be able to stop message
    /// delivery.
    /// </remarks>
    public static string FromChannel(string channel) => channel switch
    {
        FeatureFlagChangeChannel => FeatureFlagChange,
        SegmentChangeChannel => SegmentChange,
        ControlPlaneCommandChannel => ControlPlaneCommand,
        _ => channel
    };

    private const string FeatureFlagChangeChannel = "featbit_feature_flag_change_channel";
    private const string SegmentChangeChannel = "featbit_segment_change_channel";
    private const string ControlPlaneCommandChannel = "featbit_control_plane_command_channel";
}
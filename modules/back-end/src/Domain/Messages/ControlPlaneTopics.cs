namespace Domain.Messages;

public static class ControlPlaneTopics
{
    public const string ControlPlaneFeatureFlagChange = "featbit-control-plane-feature-flag-change";

    public const string ControlPlaneSegmentChange = "featbit-control-plane-segment-change";

    public const string ControlPlaneSecretChange = "featbit-control-plane-secret-change";

    public const string ControlPlaneLicenseChange = "featbit-control-plane-license-change";

    public const string ControlPlaneCommand = "featbit-control-plane-command";

    public const string ControlPlaneWebHooks = "featbit-control-plane-web-hooks";

    public const string ConnectionMade = "featbit-connection-made";

    public const string ConnectionClosed = "featbit-connection-closed";

    public const string PodHeartbeat = "featbit-pod-heartbeat";

    /// <summary>
    /// The topics the control plane consumes, in transport-agnostic form. Its DI registration
    /// hands this to whichever consumer the configured <c>MqProvider</c> selects.
    /// </summary>
    /// <remarks>
    /// <para>
    /// This is also read by <c>RedisConsumerTopics</c> to decide how the <i>producer</i> reaches
    /// these topics, which is the whole reason the list lives here rather than beside the control
    /// plane's DI code. The control plane has no MQ implementations of its own — it registers the
    /// back-end's — so under <c>MqProvider=Redis</c> it drains these with <c>LPOP</c> and a
    /// producer must therefore reach them with <c>RPUSH</c>. Keeping one list means adding a topic
    /// here routes it correctly by construction, instead of requiring a second, easily-forgotten
    /// edit in a different module.
    /// </para>
    /// <para>
    /// <see cref="ControlPlaneCommand"/> is deliberately absent: the control plane
    /// <i>publishes</i> it and the evaluation server subscribes to it, so it is pub/sub in both
    /// directions.
    /// </para>
    /// </remarks>
    public static readonly string[] Consumed =
    [
        ControlPlaneFeatureFlagChange,
        ControlPlaneSegmentChange,
        ControlPlaneSecretChange,
        ControlPlaneLicenseChange,
        ConnectionMade,
        ConnectionClosed,
        PodHeartbeat
    ];
}
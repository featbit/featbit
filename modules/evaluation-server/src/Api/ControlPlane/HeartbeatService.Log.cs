namespace Api.ControlPlane;

public partial class HeartbeatService
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Information, "HeartbeatService started with PodId: {PodId}",
            EventName = "HeartbeatServiceStarted")]
        public static partial void Started(ILogger logger, Guid podId);

        [LoggerMessage(2, LogLevel.Warning, "HeartbeatService failed to publish heartbeat for PodId: {PodId}",
            EventName = "HeartbeatPublishFailed")]
        public static partial void PublishFailed(ILogger logger, Guid podId, Exception ex);

        [LoggerMessage(3, LogLevel.Information, "HeartbeatService stopping with PodId: {PodId}",
            EventName = "HeartbeatServiceStopping")]
        public static partial void Stopping(ILogger logger, Guid podId);
    }
}

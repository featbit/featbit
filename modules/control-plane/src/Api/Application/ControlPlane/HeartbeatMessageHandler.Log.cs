using Microsoft.Extensions.Logging;

namespace Api.Application.ControlPlane;

public partial class HeartbeatMessageHandler
{
    // HealthMessage carries a pod id, a DC id, and a timestamp — no credential — so the raw
    // message is logged in full. See docs/observability/index.md section 7.
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Information, "Received heartbeat message: {Message}",
            EventName = "ReceivedHeartbeat")]
        public static partial void ReceivedHeartbeat(ILogger logger, string message);

        [LoggerMessage(2, LogLevel.Error, "Failed to process heartbeat message: {Message}",
            EventName = "ErrorProcessHeartbeat")]
        public static partial void ErrorProcessHeartbeat(ILogger logger, string message, Exception ex);

        [LoggerMessage(3, LogLevel.Warning,
            "Heartbeat cadence for DcId {DcId} exceeds the lease TTL: observed gap between " +
            "heartbeats was {GapSeconds:F1}s but ControlPlane:LeaseTtlSeconds is {LeaseTtlSeconds}s. " +
            "The DC's lease is expiring between heartbeats, causing the live set to flap. " +
            "Lower ControlPlane:HeartbeatIntervalSeconds on that DC's evaluation servers to " +
            "<= LeaseTtlSeconds/3.",
            EventName = "CadenceExceedsLeaseTtl")]
        public static partial void CadenceExceedsLeaseTtl(
            ILogger logger, string dcId, double gapSeconds, double leaseTtlSeconds);

        [LoggerMessage(4, LogLevel.Error, "Heartbeat message is null after deserialization: {Message}",
            EventName = "HeartbeatNull")]
        public static partial void HeartbeatNull(ILogger logger, string message);

        [LoggerMessage(5, LogLevel.Error, "Pod id is null or empty: {Message}",
            EventName = "PodIdMissing")]
        public static partial void PodIdMissing(ILogger logger, string message);

        [LoggerMessage(6, LogLevel.Error, "Timestamp is default value: {Message}",
            EventName = "TimestampDefault")]
        public static partial void TimestampDefault(ILogger logger, string message);
    }
}

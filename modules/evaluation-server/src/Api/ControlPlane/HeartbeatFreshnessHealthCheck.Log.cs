using Microsoft.Extensions.Logging;

namespace Api.ControlPlane;

public sealed partial class HeartbeatFreshnessHealthCheck
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Warning,
            "Heartbeat freshness unhealthy: DcId={DcId}, StalenessSeconds={StalenessSeconds}, " +
            "ThresholdSeconds={ThresholdSeconds}. Pod likely evicted/partitioned from the " +
            "control plane; failing readiness to pull it from rotation.",
            EventName = "HeartbeatFreshnessUnhealthy")]
        public static partial void HeartbeatFreshnessUnhealthy(ILogger logger, string dcId, int stalenessSeconds, int thresholdSeconds);
    }
}

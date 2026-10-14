using Microsoft.Extensions.Logging;

namespace Api.Application.ControlPlane;

public partial class PodHealthChecker
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Information, "PodHealthChecker is now {State}",
            EventName = "EnabledStateChanged")]
        public static partial void EnabledStateChanged(ILogger logger, string state);

        [LoggerMessage(2, LogLevel.Warning,
            "Skipping unhealthy pod with invalid PodId {PodId} (last heartbeat at {Timestamp})",
            EventName = "InvalidPodId")]
        public static partial void InvalidPodId(ILogger logger, string podId, DateTimeOffset timestamp);

        [LoggerMessage(3, LogLevel.Warning,
            "Pod {PodId} is considered unhealthy. Last heartbeat at {Timestamp}",
            EventName = "PodUnhealthy")]
        public static partial void PodUnhealthy(ILogger logger, string podId, DateTimeOffset timestamp);

        [LoggerMessage(4, LogLevel.Error, "Pod health check iteration failed; will retry next interval",
            EventName = "ErrorHealthCheckIteration")]
        public static partial void ErrorHealthCheckIteration(ILogger logger, Exception ex);
    }
}

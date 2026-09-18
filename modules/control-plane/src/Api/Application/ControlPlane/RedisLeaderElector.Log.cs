using Microsoft.Extensions.Logging;

namespace Api.Application.ControlPlane;

public sealed partial class RedisLeaderElector
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Information,
            "Leader election: instance {InstanceId} acquired leadership.",
            EventName = "LeadershipAcquired")]
        public static partial void LeadershipAcquired(ILogger logger, Guid instanceId);

        [LoggerMessage(2, LogLevel.Debug,
            "Leader election: instance {InstanceId} did not acquire leadership " +
            "(another instance holds the lock).",
            EventName = "LeadershipNotAcquired")]
        public static partial void LeadershipNotAcquired(ILogger logger, Guid instanceId);

        [LoggerMessage(3, LogLevel.Debug, "Leader election: instance {InstanceId} renewed leadership.",
            EventName = "LeadershipRenewed")]
        public static partial void LeadershipRenewed(ILogger logger, Guid instanceId);

        [LoggerMessage(4, LogLevel.Warning,
            "Leader election: instance {InstanceId} lost leadership (failed to extend the lock).",
            EventName = "LeadershipLost")]
        public static partial void LeadershipLost(ILogger logger, Guid instanceId);

        [LoggerMessage(5, LogLevel.Warning,
            "Leader election: instance {InstanceId} hit a Redis error while {Action}; " +
            "treating as not-leader and retrying next tick.",
            EventName = "RedisError")]
        public static partial void RedisError(ILogger logger, Guid instanceId, string action, Exception ex);

        [LoggerMessage(6, LogLevel.Information,
            "Leader election: instance {InstanceId} released leadership on shutdown.",
            EventName = "LeadershipReleased")]
        public static partial void LeadershipReleased(ILogger logger, Guid instanceId);

        [LoggerMessage(7, LogLevel.Warning,
            "Leader election: instance {InstanceId} failed to release the lock on shutdown; " +
            "it will expire via TTL instead.",
            EventName = "ErrorReleaseLock")]
        public static partial void ErrorReleaseLock(ILogger logger, Guid instanceId, Exception ex);
    }
}

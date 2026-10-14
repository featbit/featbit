using Microsoft.Extensions.Logging;

namespace Api.Application.ControlPlane;

public static partial class LeaderElectionExtensions
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Debug,
            "{WorkerName}: instance {InstanceId} is not leader; skipping tick.",
            EventName = "NotLeaderSkippingTick")]
        public static partial void NotLeaderSkippingTick(ILogger logger, string workerName, Guid instanceId);
    }
}

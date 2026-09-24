using Microsoft.Extensions.Logging;

namespace Api.Application.ControlPlane;

public sealed partial class AlwaysLeaderElection
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Information,
            "Leader election disabled (ControlPlane:LeaderElection:Enabled=false); if running " +
            "multiple control-plane replicas, enable it to avoid redundant work.",
            EventName = "LeaderElectionDisabled")]
        public static partial void LeaderElectionDisabled(ILogger logger);
    }
}
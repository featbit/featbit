using Domain.Observability;

namespace Api.Application.ControlPlane;

public sealed partial class DcIdConsistencyChecker
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Information,
            "DcId consistency checker disabled (consistency mode is not GatedCommit).",
            EventName = "DcIdConsistencyCheckerDisabled")]
        public static partial void Disabled(ILogger logger);

        [LoggerMessage(2, LogLevel.Error,
            "Error occurred while running the DcId consistency check tick.",
            EventName = "DcIdConsistencyTickFailed")]
        public static partial void TickFailed(ILogger logger, Exception ex);

        [LoggerMessage(3, LogLevel.Warning,
            "DcId consistency: configured Redis DC(s) {MissingDcs} have no reporting ELS lease " +
            "(the DC is down OR its configured DcId does not match the ELS ControlPlane:DcId). " +
            "Commits will stall for these DC(s) until a matching lease is reported.",
            EventName = "DcIdConsistencyMissingLeases")]
        public static partial void MissingLeases(ILogger logger, string missingDcs);

        [LoggerMessage(4, LogLevel.Warning,
            "DcId consistency: ELS pod(s) report lease DC(s) {UnknownDcs} that match no " +
            "configured Redis instance (an unknown DC the control plane cannot stage to). " +
            "Add a Redis:Instances entry with a matching DcId, or fix the ELS ControlPlane:DcId.",
            EventName = "DcIdConsistencyUnknownDcs")]
        public static partial void UnknownDcs(ILogger logger, string unknownDcs);
    }
}

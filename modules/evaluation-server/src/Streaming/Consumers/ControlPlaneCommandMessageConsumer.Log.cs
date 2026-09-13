using Microsoft.Extensions.Logging;

namespace Streaming.Consumers;

public partial class ControlPlaneCommandMessageConsumer
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Warning, "Invalid control plane command message format: {Message}",
            EventName = "InvalidControlPlaneCommandFormat")]
        public static partial void InvalidMessageFormat(ILogger logger, string message);

        [LoggerMessage(2, LogLevel.Debug,
            "Ignoring control plane command targeted at DC '{TargetDcId}' (local DC is '{LocalDcId}').",
            EventName = "IgnoringTargetedCommand")]
        public static partial void IgnoringTargetedCommand(ILogger logger, string? targetDcId, string? localDcId);

        [LoggerMessage(3, LogLevel.Error,
            "Exception occurred while processing control plane command message: {Message}",
            EventName = "ControlPlaneCommandProcessingFailed")]
        public static partial void ProcessingFailed(ILogger logger, string message, Exception ex);
    }
}

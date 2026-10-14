using Microsoft.Extensions.Logging;

namespace Api.Application.ControlPlane;

public partial class FeatureFlagChangeMessageHandler
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Error, "Error handling feature flag change message",
            EventName = "ErrorHandleFlagChange")]
        public static partial void ErrorHandleFlagChange(ILogger logger, Exception ex);
    }
}
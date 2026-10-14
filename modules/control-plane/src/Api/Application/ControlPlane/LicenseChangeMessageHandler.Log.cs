using Microsoft.Extensions.Logging;

namespace Api.Application.ControlPlane;

public partial class LicenseChangeMessageHandler
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Error, "Error handling license change message",
            EventName = "ErrorHandleLicenseChange")]
        public static partial void ErrorHandleLicenseChange(ILogger logger, Exception ex);
    }
}
using Microsoft.Extensions.Logging;

namespace Api.Application.ControlPlane;

public partial class SecretChangeMessageHandler
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Error, "Error handling secret change message",
            EventName = "ErrorHandleSecretChange")]
        public static partial void ErrorHandleSecretChange(ILogger logger, Exception ex);

        [LoggerMessage(2, LogLevel.Error, "Invalid secret change data: {Field} is null",
            EventName = "InvalidSecretChangeData")]
        public static partial void InvalidSecretChangeData(ILogger logger, string field);
    }
}
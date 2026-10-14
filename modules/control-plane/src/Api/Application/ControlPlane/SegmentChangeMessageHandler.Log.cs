using Microsoft.Extensions.Logging;

namespace Api.Application.ControlPlane;

public partial class SegmentChangeMessageHandler
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Error, "Error processing segment change message",
            EventName = "ErrorHandleSegmentChange")]
        public static partial void ErrorHandleSegmentChange(ILogger logger, Exception ex);
    }
}
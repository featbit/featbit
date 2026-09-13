using Microsoft.Extensions.Logging;

namespace Api.Application.Admin;

public partial class PushFullSyncHandler
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Error, "Error occurred while handling PushFullSync request.",
            EventName = "ErrorPushFullSync")]
        public static partial void ErrorPushFullSync(ILogger logger, Exception ex);
    }
}
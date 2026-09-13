using Microsoft.Extensions.Logging;

namespace Infrastructure.AppService;

public partial class UsageFlushWorker
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Error, "Exception occurred while flushing usage records.",
            EventName = "ErrorFlushUsageRecords")]
        public static partial void ErrorFlushUsageRecords(ILogger logger, Exception ex);
    }
}

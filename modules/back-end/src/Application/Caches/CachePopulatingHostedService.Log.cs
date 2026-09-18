using Microsoft.Extensions.Logging;

namespace Application.Caches;

public partial class CachePopulatingHostedService
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Critical, "Exception occurred when populating cache. Host will not start.",
            EventName = "ErrorPopulateCache")]
        public static partial void ErrorPopulateCache(ILogger logger, Exception ex);
    }
}
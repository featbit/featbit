using Microsoft.Extensions.Logging;

namespace Infrastructure.Store;

public partial class StoreAvailableSentinel
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Information,
            "Store availability sentinel started. Default available store: {Store}.",
            EventName = "SentinelStarted")]
        public static partial void SentinelStarted(ILogger logger, string store);

        [LoggerMessage(2, LogLevel.Error, "Error occurred while checking store availability",
            EventName = "AvailabilityCheckFailed")]
        public static partial void AvailabilityCheckFailed(ILogger logger, Exception ex);

        [LoggerMessage(3, LogLevel.Debug, "Store availability check timed out for {Store}.",
            EventName = "AvailabilityCheckTimedOut")]
        public static partial void AvailabilityCheckTimedOut(ILogger logger, string store);

        [LoggerMessage(4, LogLevel.Error, "No available store can be used.",
            EventName = "NoStoreAvailable")]
        public static partial void NoStoreAvailable(ILogger logger);

        [LoggerMessage(5, LogLevel.Information, "Store availability sentinel stopped.",
            EventName = "SentinelStopped")]
        public static partial void SentinelStopped(ILogger logger);
    }
}

using Microsoft.Extensions.Logging;

namespace Infrastructure.Store;

public partial class HybridStore
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Warning, "Store availability changed from {prev} to {current}",
            EventName = "StoreAvailabilityChanged")]
        public static partial void AvailabilityChanged(ILogger logger, string prev, string current);
    }
}

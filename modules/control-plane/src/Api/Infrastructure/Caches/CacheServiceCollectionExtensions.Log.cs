using Microsoft.Extensions.Logging;

namespace Api.Infrastructure.Caches;

public static partial class CacheServiceCollectionExtensions
{
    public static partial class Log
    {
        // The template names {Index} twice and both arguments were the same value, so one
        // parameter renders identically and avoids a duplicate key in the structured payload.
        [LoggerMessage(1, LogLevel.Warning,
            "Redis:Instances[{Index}] has no DcId configured; " +
            "falling back to ordinal index '{Index}' as the DC key. " +
            "Configure a DcId per instance for stable per-DC broadcast results.",
            EventName = "InstanceMissingDcId")]
        public static partial void InstanceMissingDcId(ILogger logger, int index);
    }
}
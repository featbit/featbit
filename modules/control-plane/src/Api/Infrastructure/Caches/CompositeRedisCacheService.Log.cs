using Microsoft.Extensions.Logging;

namespace Api.Infrastructure.Caches;

public partial class CompositeRedisCacheService
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Error,
            "Redis cache operation '{Operation}' failed for DC {DcId} (implementation {CacheService}). Trying next instance.",
            EventName = "ErrorCacheOperationTryingNext")]
        public static partial void ErrorCacheOperationTryingNext(
            ILogger logger, string operation, string dcId, string? cacheService, Exception ex);

        [LoggerMessage(2, LogLevel.Warning,
            "Targeted cache operation '{Operation}' requested for unknown DC {DcId}; no matching cache instance. No-op.",
            EventName = "UnknownDcForTargetedOperation")]
        public static partial void UnknownDcForTargetedOperation(
            ILogger logger, string operation, string dcId);

        [LoggerMessage(3, LogLevel.Error,
            "{ProbeName} probe failed for DC {DcId} (implementation {CacheService}). Reporting not-staged.",
            EventName = "ErrorProbe")]
        public static partial void ErrorProbe(
            ILogger logger, string probeName, string dcId, string? cacheService, Exception ex);

        [LoggerMessage(4, LogLevel.Error,
            "Redis cache broadcast operation '{Operation}' failed for DC {DcId} (implementation {CacheService}). Continuing.",
            EventName = "ErrorBroadcastOperation")]
        public static partial void ErrorBroadcastOperation(
            ILogger logger, string operation, string dcId, string? cacheService, Exception ex);

        [LoggerMessage(5, LogLevel.Error,
            "Redis cache targeted operation '{Operation}' failed for DC {DcId} (implementation {CacheService}).",
            EventName = "ErrorTargetedOperation")]
        public static partial void ErrorTargetedOperation(
            ILogger logger, string operation, string dcId, string? cacheService, Exception ex);
    }
}

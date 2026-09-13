using Application.ControlPlane;
using Microsoft.Extensions.Logging;

namespace Api.Application.ControlPlane;

public sealed partial class CacheReconciler
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Information,
            "Cache reconciler disabled (ControlPlane:CacheReconcile:Enabled=false).",
            EventName = "ReconcilerDisabled")]
        public static partial void ReconcilerDisabled(ILogger logger);

        [LoggerMessage(2, LogLevel.Information,
            "Cache reconciler has no DCs configured (cache provider is not Redis); nothing to reconcile.",
            EventName = "NoDcsConfigured")]
        public static partial void NoDcsConfigured(ILogger logger);

        [LoggerMessage(3, LogLevel.Error, "Error occurred while running the cache reconciler tick.",
            EventName = "ErrorReconcileTick")]
        public static partial void ErrorReconcileTick(ILogger logger, Exception ex);

        [LoggerMessage(4, LogLevel.Debug,
            "Cache reconciler: could not read connection state for DC {DcId}; will retry next tick.",
            EventName = "ErrorReadConnectionState")]
        public static partial void ErrorReadConnectionState(ILogger logger, string dcId, Exception ex);

        [LoggerMessage(5, LogLevel.Warning,
            "Cache reconciler: composite Redis cache is unavailable; skipping backfill for " +
            "{Count} newly reachable DC(s) this tick ({DcIds}). Will retry next tick.",
            EventName = "CompositeCacheUnavailable")]
        public static partial void CompositeCacheUnavailable(ILogger logger, int count, string dcIds);

        [LoggerMessage(6, LogLevel.Error,
            "Cache reconciler: failed to fetch the shared committed snapshot for {Count} newly " +
            "reachable DC(s); all will retry on a later tick.",
            EventName = "ErrorFetchSnapshot")]
        public static partial void ErrorFetchSnapshot(ILogger logger, int count, Exception ex);

        [LoggerMessage(7, LogLevel.Information,
            "Cache reconciler: {Scope} DC {DcId} is reachable but was successfully backfilled " +
            "{ElapsedSeconds}s ago (< the {CooldownSeconds}s min-backfill-interval cooldown); " +
            "skipping this tick.",
            EventName = "BackfillCooldown")]
        public static partial void BackfillCooldown(
            ILogger logger, string scope, string dcId, int elapsedSeconds, int cooldownSeconds);

        [LoggerMessage(8, LogLevel.Information,
            "Cache reconciler: {Scope} DC {DcId} is reachable; backfilling its cache from the source of truth ({Mode}).",
            EventName = "BackfillStarting")]
        public static partial void BackfillStarting(
            ILogger logger, string scope, string dcId, ConsistencyMode mode);

        [LoggerMessage(9, LogLevel.Error,
            "Cache reconciler: backfill failed for DC {DcId}; will retry on a later tick.",
            EventName = "ErrorBackfill")]
        public static partial void ErrorBackfill(ILogger logger, string dcId, Exception ex);
    }
}

using Application.ControlPlane;
using Microsoft.Extensions.Logging;

namespace Api.Application.ControlPlane;

public sealed partial class DcBackfiller
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Debug,
            "DC backfill: a backfill for DC {DcId} is already in flight; coalescing (no-op).",
            EventName = "BackfillCoalesced")]
        public static partial void BackfillCoalesced(ILogger logger, string dcId);

        [LoggerMessage(2, LogLevel.Information,
            "DC backfill: repaired DC {DcId} ({Mode}) from source of truth: {AcceptedFlags}/{AttemptedFlags} " +
            "flag(s) accepted, {AcceptedSegments}/{AttemptedSegments} segment(s) accepted, and " +
            "{SecretCount} secret(s) upserted (unconditional, not guarded).",
            EventName = "DcRepaired")]
        public static partial void DcRepaired(
            ILogger logger,
            string dcId,
            ConsistencyMode mode,
            int acceptedFlags,
            int attemptedFlags,
            int acceptedSegments,
            int attemptedSegments,
            int secretCount);

        [LoggerMessage(3, LogLevel.Warning,
            "DC backfill requires the composite Redis cache (got {CacheType}); skipping backfill for DC {DcId}.",
            EventName = "CompositeCacheRequired")]
        public static partial void CompositeCacheRequired(ILogger logger, string? cacheType, string dcId);

        [LoggerMessage(4, LogLevel.Error,
            "DC backfill: failed to publish per-DC client refresh (PushFullSync) for DC {DcId}. " +
            "Backfill succeeded; clients on that DC will refresh on their next reconnect.",
            EventName = "ErrorPublishClientRefresh")]
        public static partial void ErrorPublishClientRefresh(ILogger logger, string dcId, Exception ex);
    }
}

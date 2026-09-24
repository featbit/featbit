using Microsoft.Extensions.Logging;

namespace Api.Application.ControlPlane;

public sealed partial class RecoveryWorker
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Information,
            "Recovery worker disabled (consistency mode is not GatedCommit).",
            EventName = "WorkerDisabled")]
        public static partial void WorkerDisabled(ILogger logger);

        [LoggerMessage(2, LogLevel.Information,
            "Recovery worker backfilled {BackfilledCount} returning DC(s).",
            EventName = "Backfilled")]
        public static partial void Backfilled(ILogger logger, int backfilledCount);

        [LoggerMessage(3, LogLevel.Error, "Error occurred while running the recovery worker tick.",
            EventName = "ErrorTick")]
        public static partial void ErrorTick(ILogger logger, Exception ex);

        [LoggerMessage(4, LogLevel.Warning,
            "Recovery worker: composite Redis cache is unavailable; skipping backfill for " +
            "{Count} returned DC(s) this tick ({DcIds}). Will retry once they are re-detected " +
            "as returned.",
            EventName = "CompositeCacheUnavailable")]
        public static partial void CompositeCacheUnavailable(ILogger logger, int count, string dcIds);

        [LoggerMessage(5, LogLevel.Debug,
            "Recovery worker: backfill for returned DC {DcId} was skipped this tick " +
            "(coalesced with a concurrent backfill already in flight for that DC).",
            EventName = "BackfillCoalesced")]
        public static partial void BackfillCoalesced(ILogger logger, string dcId);

        [LoggerMessage(6, LogLevel.Debug,
            "Recovery worker: backfill for returned DC {DcId} ran but the only-advance guard " +
            "accepted zero flag writes (its Redis already matched the source of truth); not " +
            "counted as a repair.",
            EventName = "BackfillNoWrites")]
        public static partial void BackfillNoWrites(ILogger logger, string dcId);
    }
}

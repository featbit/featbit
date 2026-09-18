using Microsoft.Extensions.Logging;

namespace Api.Application.ControlPlane;

public sealed partial class CommitCoordinatorWorker
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Information,
            "Commit coordinator disabled (consistency mode is not GatedCommit).",
            EventName = "WorkerDisabled")]
        public static partial void WorkerDisabled(ILogger logger);

        [LoggerMessage(2, LogLevel.Information,
            "Commit coordinator committed {CommittedCount} pending flag/segment change(s).",
            EventName = "Committed")]
        public static partial void Committed(ILogger logger, int committedCount);

        [LoggerMessage(3, LogLevel.Error, "Error occurred while running the commit coordinator tick.",
            EventName = "ErrorTick")]
        public static partial void ErrorTick(ILogger logger, Exception ex);

        [LoggerMessage(4, LogLevel.Warning,
            "Commit coordinator requires the composite Redis cache (got {CacheType}); skipping tick.",
            EventName = "CompositeCacheRequired")]
        public static partial void CompositeCacheRequired(ILogger logger, string? cacheType);

        [LoggerMessage(5, LogLevel.Warning,
            "Committed flag {FlagId} v{Version} without DC(s) {EvictedDcs} — proceeding on live set.",
            EventName = "FlagCommittedWithEvictedDcs")]
        public static partial void FlagCommittedWithEvictedDcs(
            ILogger logger, Guid flagId, long version, string evictedDcs);

        [LoggerMessage(6, LogLevel.Warning,
            "Committed segment {SegmentId} v{Version} without DC(s) {EvictedDcs} — proceeding on live set.",
            EventName = "SegmentCommittedWithEvictedDcs")]
        public static partial void SegmentCommittedWithEvictedDcs(
            ILogger logger, Guid segmentId, long version, string evictedDcs);
    }
}

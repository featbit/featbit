using Microsoft.Extensions.Logging;

namespace Infrastructure.AppService;

public sealed partial class StagedFlagGcWorker
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Information,
            "Staged flag GC worker disabled (consistency mode is not GatedCommit).",
            EventName = "WorkerDisabled")]
        public static partial void WorkerDisabled(ILogger logger);

        [LoggerMessage(2, LogLevel.Information,
            "Staged flag GC swept {DeletedCount} superseded versioned flag key(s).",
            EventName = "SweptKeys")]
        public static partial void SweptKeys(ILogger logger, int deletedCount);

        [LoggerMessage(3, LogLevel.Error, "Error occurred while sweeping staged flag versions.",
            EventName = "ErrorSweep")]
        public static partial void ErrorSweep(ILogger logger, Exception ex);
    }
}

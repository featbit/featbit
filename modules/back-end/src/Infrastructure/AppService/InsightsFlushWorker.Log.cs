using Microsoft.Extensions.Logging;

namespace Infrastructure.AppService;

public sealed partial class InsightsFlushWorker
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Information, "Start flushing insight loop...",
            EventName = "StartFlushLoop")]
        public static partial void StartFlushLoop(ILogger logger);

        [LoggerMessage(2, LogLevel.Information, "Insights flush worker stopped...",
            EventName = "WorkerStopped")]
        public static partial void WorkerStopped(ILogger logger);

        [LoggerMessage(3, LogLevel.Debug, "{Count} insight events have been handled.",
            EventName = "EventsHandled")]
        public static partial void EventsHandled(ILogger logger, int count);

        [LoggerMessage(4, LogLevel.Error, "Failed to flush {Count} insight events.",
            EventName = "ErrorFlushEvents")]
        public static partial void ErrorFlushEvents(ILogger logger, int count, Exception ex);
    }
}

using Microsoft.Extensions.Logging;

namespace Infrastructure.AppService;

public partial class FlagScheduleWorker
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Information, "Stopping flag schedule worker...",
            EventName = "StoppingWorker")]
        public static partial void StoppingWorker(ILogger logger);

        [LoggerMessage(2, LogLevel.Information,
            "{ScheduleId}:{ScheduleTitle}: Flag schedule has been applied.",
            EventName = "ScheduleApplied")]
        public static partial void ScheduleApplied(ILogger logger, Guid scheduleId, string scheduleTitle);

        [LoggerMessage(3, LogLevel.Error,
            "{ScheduleId}:{ScheduleTitle}: Error occurred while applying flag schedule.",
            EventName = "ErrorApplySchedule")]
        public static partial void ErrorApplySchedule(
            ILogger logger, Guid scheduleId, string scheduleTitle, Exception ex);

        [LoggerMessage(4, LogLevel.Error, "Error occurred while processing flag schedule.",
            EventName = "ErrorProcessSchedule")]
        public static partial void ErrorProcessSchedule(ILogger logger, Exception ex);
    }
}

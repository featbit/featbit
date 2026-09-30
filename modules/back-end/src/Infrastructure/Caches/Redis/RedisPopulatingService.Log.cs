using Microsoft.Extensions.Logging;

namespace Infrastructure.Caches.Redis;

public partial class RedisPopulatingService
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Information, "Verifying redis population status on startup...",
            EventName = "VerifyingPopulationStatus")]
        public static partial void VerifyingPopulationStatus(ILogger logger);

        [LoggerMessage(2, LogLevel.Information, "Redis has been populated, proceeding with service startup.",
            EventName = "AlreadyPopulated")]
        public static partial void AlreadyPopulated(ILogger logger);

        [LoggerMessage(3, LogLevel.Information,
            "Redis populated by another instance, proceeding with service startup.",
            EventName = "PopulatedByAnotherInstance")]
        public static partial void PopulatedByAnotherInstance(ILogger logger);

        [LoggerMessage(4, LogLevel.Information, "Start to populate redis. Lock TTL: {LockTtl}s.",
            EventName = "StartPopulate")]
        public static partial void StartPopulate(ILogger logger, double lockTtl);

        [LoggerMessage(5, LogLevel.Information, "Populate redis finished in {Elapsed} ms.",
            EventName = "PopulateFinished")]
        public static partial void PopulateFinished(ILogger logger, long elapsed);

        [LoggerMessage(6, LogLevel.Information,
            "Another instance is populating Redis. Waiting {PollIntervalSeconds}s before " +
            "re-checking (elapsed: {ElapsedSeconds:F0}s).",
            EventName = "WaitingForAnotherInstance")]
        public static partial void WaitingForAnotherInstance(
            ILogger logger, double pollIntervalSeconds, double elapsedSeconds);

        [LoggerMessage(7, LogLevel.Information, "Populate flag success, total count: {Total}",
            EventName = "PopulateFlagSuccess")]
        public static partial void PopulateFlagSuccess(ILogger logger, int total);

        [LoggerMessage(8, LogLevel.Information, "Populate segment success, total count: {Total}",
            EventName = "PopulateSegmentSuccess")]
        public static partial void PopulateSegmentSuccess(ILogger logger, int total);

        [LoggerMessage(9, LogLevel.Information, "Populate secrets success, total count: {Total}",
            EventName = "PopulateSecretsSuccess")]
        public static partial void PopulateSecretsSuccess(ILogger logger, int total);
    }
}

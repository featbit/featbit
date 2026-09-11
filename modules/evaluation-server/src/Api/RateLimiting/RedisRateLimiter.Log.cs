using Microsoft.Extensions.Logging;

namespace Api.RateLimiting;

public sealed partial class RedisRateLimiter
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Warning, "Redis rate-limit evaluation failed for {PartitionKey}; failing open",
            EventName = "RedisRateLimitEvaluationFailed")]
        public static partial void EvaluationFailed(ILogger logger, string partitionKey, Exception ex);

        [LoggerMessage(2, LogLevel.Warning, "Redis rate-limit evaluation timed out for {PartitionKey}; failing open",
            EventName = "RedisRateLimitEvaluationTimedOut")]
        public static partial void EvaluationTimedOut(ILogger logger, string partitionKey, Exception ex);
    }
}

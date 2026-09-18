using Microsoft.Extensions.Logging;

namespace Api.RateLimiting;

public static partial class RateLimiterRegister
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Warning, "Rate limit exceeded for EnvId {EnvId} on {Path}",
            EventName = "RateLimitExceeded")]
        public static partial void RateLimitExceeded(ILogger logger, Guid envId, PathString path);
    }
}

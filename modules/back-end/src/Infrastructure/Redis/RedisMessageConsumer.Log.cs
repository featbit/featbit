using Microsoft.Extensions.Logging;

namespace Infrastructure.Redis;

public partial class RedisMessageConsumer
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Error, "Exception occurred when consume message: {Message}.",
            EventName = "ErrorConsumeMessage")]
        public static partial void ErrorConsumeMessage(ILogger logger, string message, Exception exception);
    }
}
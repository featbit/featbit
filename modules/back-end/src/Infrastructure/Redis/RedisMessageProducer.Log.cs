using Microsoft.Extensions.Logging;

namespace Infrastructure.Redis;

public partial class RedisMessageProducer
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Debug, "Message {Message} was published successfully.",
            EventName = "MessagePublished")]
        public static partial void MessagePublished(ILogger<RedisMessageProducer> logger, string message);

        [LoggerMessage(2, LogLevel.Error, "Exception occurred while publishing message.",
            EventName = "ErrorPublishMessage")]
        public static partial void ErrorPublishMessage(ILogger logger, Exception exception);
    }
}
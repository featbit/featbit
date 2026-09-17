using Microsoft.Extensions.Logging;

namespace Infrastructure.MQ.Redis;

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

        [LoggerMessage(3, LogLevel.Debug, "Published {Count} messages to {Topic}.",
            EventName = "MessageBatchPublished")]
        public static partial void MessageBatchPublished(ILogger<RedisMessageProducer> logger, int count, string topic);
    }
}
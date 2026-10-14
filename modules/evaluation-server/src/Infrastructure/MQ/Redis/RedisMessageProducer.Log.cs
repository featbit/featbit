using Domain.Observability;
using Microsoft.Extensions.Logging;

namespace Infrastructure.MQ.Redis;

public partial class RedisMessageProducer
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Debug, "Message {Message} was published successfully.",
            EventName = "MessagePublished")]
        private static partial void MessagePublishedCore(ILogger<RedisMessageProducer> logger, string message);

        /// <summary>
        /// Logs a published message. The body carries flag rules, end-user attributes, and SDK
        /// secrets, so it is logged in full with any embedded credential hashed (<c>docs/observability/index.md</c> §7).
        /// </summary>
        public static void MessagePublished(ILogger<RedisMessageProducer> logger, string message)
            => MessagePublishedCore(logger, Redaction.HideCredentials(message));

        [LoggerMessage(2, LogLevel.Error, "Exception occurred while publishing message.",
            EventName = "ErrorPublishMessage")]
        public static partial void ErrorPublishMessage(ILogger logger, Exception exception);

        [LoggerMessage(3, LogLevel.Debug, "Published {Count} messages to {Topic}.",
            EventName = "MessageBatchPublished")]
        public static partial void MessageBatchPublished(ILogger<RedisMessageProducer> logger, int count, string topic);
    }
}
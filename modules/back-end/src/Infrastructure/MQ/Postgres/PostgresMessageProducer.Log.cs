using Domain.Observability;
using Microsoft.Extensions.Logging;

namespace Infrastructure.MQ.Postgres;

public partial class PostgresMessageProducer
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Debug, "Message published. Topic: {Topic}. Message(Id={Id}): {Message}",
            EventName = "MessagePublished")]
        private static partial void MessagePublishedCore(ILogger logger, string topic, string id, string message);

        /// <summary>
        /// Logs a published message. The body carries flag rules, end-user attributes, and SDK
        /// secrets, so it is logged in full with any embedded credential hashed (<c>docs/observability/index.md</c> §7). The topic
        /// and row id are what let the message be found again.
        /// </summary>
        public static void MessagePublished(ILogger logger, string topic, string id, string message)
            => MessagePublishedCore(logger, topic, id, Redaction.HideCredentials(message));

        [LoggerMessage(2, LogLevel.Error, "Exception occurred while publishing message.",
            EventName = "ErrorPublishMessage")]
        public static partial void ErrorPublishMessage(ILogger logger, Exception exception);

        [LoggerMessage(3, LogLevel.Information, "Notifications cleaned. Count: {Count}",
            EventName = "NotificationsCleaned")]
        public static partial void NotificationsCleaned(ILogger logger, int count);

        [LoggerMessage(4, LogLevel.Error, "Exception occurred while cleaning notifications.",
            EventName = "ErrorCleanupNotifications")]
        public static partial void ErrorCleanupNotifications(ILogger logger, Exception exception);
    }
}
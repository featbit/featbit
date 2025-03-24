using Microsoft.Extensions.Logging;

namespace Infrastructure.MQ.Postgres;

public partial class PostgresMessageProducer
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Debug, "Message published. Topic: {Topic}. Message(Id={Id}): {Message}",
            EventName = "MessagePublished")]
        public static partial void MessagePublished(ILogger logger, string topic, string id, string message);

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
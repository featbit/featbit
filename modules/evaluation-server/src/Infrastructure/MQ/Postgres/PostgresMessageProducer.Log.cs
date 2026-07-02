using Microsoft.Extensions.Logging;

namespace Infrastructure.MQ.Postgres;

public partial class PostgresMessageProducer
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Debug, "Message published. Topic: {Topic}. Message(Id={Id}): {Message}",
            EventName = "MessagePublished")]
        public static partial void MessagePublished(ILogger logger, string topic, long id, string message);

        [LoggerMessage(2, LogLevel.Error, "Exception occurred while publishing message.",
            EventName = "ErrorPublishMessage")]
        public static partial void ErrorPublishMessage(ILogger logger, Exception exception);
    }
}
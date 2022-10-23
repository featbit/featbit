using Microsoft.Extensions.Logging;

namespace Infrastructure.Kafka;

partial class KafkaMessageConsumer
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Warning, "No message handler for topic: {Topic}", EventName = "NoHandlerForTopic")]
        public static partial void NoHandlerForTopic(ILogger logger, string topic);

        [LoggerMessage(2, LogLevel.Error, "Exception occured when consume message.", EventName = "ErrorConsumeMessage")]
        public static partial void ErrorConsumeMessage(ILogger logger, Exception exception);

        [LoggerMessage(3, LogLevel.Error, "Failed consume message. Error: {Error}", EventName = "FailedConsumeMessage")]
        public static partial void FailedConsumeMessage(ILogger logger, string error);
    }
}
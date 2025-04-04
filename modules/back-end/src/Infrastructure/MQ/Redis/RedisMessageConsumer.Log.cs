using Microsoft.Extensions.Logging;

namespace Infrastructure.MQ.Redis;

public partial class RedisMessageConsumer
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Warning, "No message handler for topic: {Topic}", EventName = "NoHandlerForTopic")]
        public static partial void NoHandlerForTopic(ILogger logger, string topic);

        [LoggerMessage(2, LogLevel.Debug, "Message handled: {Message}", EventName = "MessageHandled")]
        public static partial void MessageHandled(ILogger logger, string message);

        [LoggerMessage(3, LogLevel.Error, "Exception occurred while consuming message: {Message}.",
            EventName = "ErrorConsumeMessage")]
        public static partial void ErrorConsumeMessage(ILogger logger, string message, Exception exception);

        [LoggerMessage(4, LogLevel.Error, "Exception occurred while consuming topic: {Topic}.",
            EventName = "ErrorConsumeTopic")]
        public static partial void ErrorConsumeTopic(ILogger logger, string topic, Exception ex);
    }
}
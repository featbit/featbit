using Domain.Observability;
using Microsoft.Extensions.Logging;

namespace Infrastructure.MQ.Redis;

public partial class RedisMessageConsumer
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Warning, "No message handler for topic: {Topic}", EventName = "NoHandlerForTopic")]
        public static partial void NoHandlerForTopic(ILogger logger, string topic);

        [LoggerMessage(2, LogLevel.Debug, "Message handled: {Message}", EventName = "MessageHandled")]
        private static partial void MessageHandledCore(ILogger logger, string message);

        /// <summary>
        /// Logs a successfully handled message. The body carries flag rules, end-user attributes, and
        /// SDK secrets, so it is logged in full with any embedded credential hashed (<c>docs/observability/index.md</c> §7).
        /// </summary>
        public static void MessageHandled(ILogger logger, string message)
            => MessageHandledCore(logger, Redaction.HideCredentials(message));

        [LoggerMessage(3, LogLevel.Error, "Exception occurred while consuming message: {Message}.",
            EventName = "ErrorConsumeMessage")]
        private static partial void ErrorConsumeMessageCore(ILogger logger, string message, Exception exception);

        /// <summary>Logs a failed message consume, with the body logged in full apart from any embedded credential.</summary>
        public static void ErrorConsumeMessage(ILogger logger, string message, Exception exception)
            => ErrorConsumeMessageCore(logger, Redaction.HideCredentials(message), exception);

        [LoggerMessage(4, LogLevel.Error, "Exception occurred while consuming topic: {Topic}.",
            EventName = "ErrorConsumeTopic")]
        public static partial void ErrorConsumeTopic(ILogger logger, string topic, Exception ex);

        [LoggerMessage(5, LogLevel.Information, "Start consuming {Topic} messages...",
            EventName = "StartConsuming")]
        public static partial void StartConsuming(ILogger logger, string topic);
    }
}
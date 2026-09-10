using Domain.Observability;
using Microsoft.Extensions.Logging;

namespace Infrastructure.MQ.Kafka;

public partial class KafkaMessageConsumer
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Error, "Exception occurred when consume message: {Message}.",
            EventName = "ErrorConsumeMessage")]
        private static partial void ErrorConsumeMessageCore(ILogger logger, string message, Exception exception);

        /// <summary>
        /// Logs a failed message consume. The body carries flag rules, end-user attributes, and SDK
        /// secrets, so it is logged in full with any embedded credential hashed (<c>docs/observability/index.md</c> §7).
        /// </summary>
        public static void ErrorConsumeMessage(ILogger logger, string message, Exception exception)
            => ErrorConsumeMessageCore(logger, Redaction.HideCredentials(message), exception);

        [LoggerMessage(2, LogLevel.Error, "Failed consume message: {Message}. Error: {Error}",
            EventName = "FailedConsumeMessage")]
        private static partial void FailedConsumeMessageCore(ILogger logger, string message, string error);

        /// <summary>Logs a broker-reported consume failure, with the body logged in full apart from any embedded credential.</summary>
        public static void FailedConsumeMessage(ILogger logger, string message, string error)
            => FailedConsumeMessageCore(logger, Redaction.HideCredentials(message), error);

        [LoggerMessage(3, LogLevel.Error, "Exception occurred when store offset.", EventName = "ErrorStoreOffset")]
        public static partial void ErrorStoreOffset(ILogger logger, Exception ex);

        [LoggerMessage(4, LogLevel.Warning, "No message handler for topic: {Topic}", EventName = "NoHandlerForTopic")]
        public static partial void NoHandlerForTopic(ILogger logger, string topic);
    }
}
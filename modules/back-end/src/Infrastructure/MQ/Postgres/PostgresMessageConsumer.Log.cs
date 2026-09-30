using Domain.Observability;
using Microsoft.Extensions.Logging;

namespace Infrastructure.MQ.Postgres;

public partial class PostgresMessageConsumer
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Information, "Start consuming {Topic} messages.", EventName = "StartConsumingTopic")]
        public static partial void StartConsumingTopic(ILogger logger, string topic);

        [LoggerMessage(2, LogLevel.Debug, "Polled {Count} messages from {Topic} for processing.",
            EventName = "MessagePolled")]
        public static partial void MessagePolled(ILogger logger, string topic, int count);

        [LoggerMessage(3, LogLevel.Warning, "No message handler for topic: {Topic}", EventName = "NoHandlerForTopic")]
        public static partial void NoHandlerForTopic(ILogger logger, string topic);

        [LoggerMessage(4, LogLevel.Debug, "Message handled: {Message}", EventName = "MessageHandled")]
        private static partial void MessageHandledCore(ILogger logger, string message);

        /// <summary>
        /// Logs a successfully handled message. The body carries flag rules, end-user attributes, and
        /// SDK secrets, so it is logged in full with any embedded credential hashed (<c>docs/observability/index.md</c> §7).
        /// </summary>
        public static void MessageHandled(ILogger logger, string message)
            => MessageHandledCore(logger, Redaction.HideCredentials(message));

        [LoggerMessage(5, LogLevel.Error, "Exception occurred while consuming message: {Message}.",
            EventName = "ErrorConsumeMessage")]
        private static partial void ErrorConsumeMessageCore(ILogger logger, string message, Exception exception);

        /// <summary>Logs a failed message consume, with the body logged in full apart from any embedded credential.</summary>
        public static void ErrorConsumeMessage(ILogger logger, string message, Exception exception)
            => ErrorConsumeMessageCore(logger, Redaction.HideCredentials(message), exception);

        [LoggerMessage(6, LogLevel.Debug, "Message {Id} processed with status {Status}. {Error}",
            EventName = "MessageProcessed")]
        public static partial void MessageProcessed(ILogger logger, long id, string status, string error);

        [LoggerMessage(7, LogLevel.Error,
            "Exception occurred while consuming topic: {Topic}. Will retry in {Interval} seconds.",
            EventName = "ErrorConsumeTopic")]
        public static partial void ErrorConsumeTopic(ILogger logger, string topic, int interval, Exception ex);

        [LoggerMessage(8, LogLevel.Debug,
            "Wait for {Interval} seconds before the next poll because message count {MessageCount} is less than the batch size {BatchSize}.",
            EventName = "WaitForNextPoll")]
        public static partial void WaitForNextPoll(ILogger logger, int interval, int messageCount, int batchSize);
    }
}
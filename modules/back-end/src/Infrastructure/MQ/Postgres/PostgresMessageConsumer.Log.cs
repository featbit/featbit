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
        public static partial void MessageHandled(ILogger logger, string message);

        [LoggerMessage(5, LogLevel.Error, "Exception occurred while consuming message: {Message}.",
            EventName = "ErrorConsumeMessage")]
        public static partial void ErrorConsumeMessage(ILogger logger, string message, Exception exception);

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
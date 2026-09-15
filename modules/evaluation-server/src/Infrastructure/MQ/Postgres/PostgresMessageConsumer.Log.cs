using Domain.Observability;
using Microsoft.Extensions.Logging;

namespace Infrastructure.MQ.Postgres;

public partial class PostgresMessageConsumer
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Warning, "Detected connection state changed from {From} to {To}.",
            EventName = "ConnectionStateChanged")]
        public static partial void ConnectionStateChanged(ILogger logger, string from, string to);

        [LoggerMessage(2, LogLevel.Information, "Start listening channels: {Channels}",
            EventName = "StartListening")]
        public static partial void StartListening(ILogger logger, string channels);

        [LoggerMessage(3, LogLevel.Debug, "Waiting for new notification...",
            EventName = "WaitNotification")]
        public static partial void WaitNotification(ILogger logger);

        [LoggerMessage(4, LogLevel.Debug, "Notification received from {Channel}(PID={PID}): {Payload}",
            EventName = "ReceiveNotification")]
        private static partial void NotificationReceivedCore(ILogger logger, string channel, int pid, string payload);

        /// <summary>
        /// Logs a received notification. The payload carries flag rules, end-user attributes, and SDK
        /// secrets, so it is logged in full with any embedded credential hashed (<c>docs/observability/index.md</c> §7). The channel
        /// is what actually localizes a problem.
        /// </summary>
        public static void NotificationReceived(ILogger logger, string channel, int pid, string payload)
            => NotificationReceivedCore(logger, channel, pid, Redaction.HideCredentials(payload));

        [LoggerMessage(5, LogLevel.Error, "Exception occurred while waiting for channel notification.",
            EventName = "ErrorWaitNotification")]
        public static partial void ErrorWaitNotification(ILogger logger, Exception exception);

        [LoggerMessage(6, LogLevel.Warning,
            "Listening stopped due to start error. Will restart in {RestartIntervalInSeconds} seconds.",
            EventName = "ListenStoppedDueToStartError")]
        public static partial void ListenStoppedDueToStartError(ILogger logger, int restartIntervalInSeconds);

        [LoggerMessage(7, LogLevel.Warning,
            "Listening stopped due to connection closed. Will restart in {RestartIntervalInSeconds} seconds.",
            EventName = "ListenStoppedDueToConnectionClosed")]
        public static partial void ListenStoppedDueToConnectionClosed(ILogger logger, int restartIntervalInSeconds);

        [LoggerMessage(8, LogLevel.Warning, "No message handler for channel: {Channel}",
            EventName = "NoHandlerForChannel")]
        public static partial void NoHandlerForChannel(ILogger logger, string channel);

        [LoggerMessage(9, LogLevel.Debug, "Message handled: {Id}", EventName = "MessageHandled")]
        public static partial void MessageHandled(ILogger logger, long id);

        [LoggerMessage(10, LogLevel.Error, "Exception occurred while consuming message: {Message}.",
            EventName = "ErrorConsumeMessage")]
        private static partial void ErrorConsumeMessageCore(ILogger logger, string message, Exception exception);

        /// <summary>Logs a failed message consume, with the body logged in full apart from any embedded credential.</summary>
        public static void ErrorConsumeMessage(ILogger logger, string message, Exception exception)
            => ErrorConsumeMessageCore(logger, Redaction.HideCredentials(message), exception);

        [LoggerMessage(11, LogLevel.Information, "Listening stopped.", EventName = "ListeningStopped")]
        public static partial void ListeningStopped(ILogger logger);

        [LoggerMessage(12, LogLevel.Error,
            "Exception occurred while starting listening. Will restart in {RestartIntervalInSeconds} seconds.",
            EventName = "ErrorStartListening")]
        public static partial void ErrorStartListening(ILogger logger, int restartIntervalInSeconds,
            Exception exception);

        [LoggerMessage(13, LogLevel.Error, "Exception occurred while disposing current connection.",
            EventName = "ErrorDisposeConnection")]
        public static partial void ErrorDisposeConnection(ILogger logger, Exception exception);

        [LoggerMessage(14, LogLevel.Debug, "Connection disposed.", EventName = "ConnectionDisposed")]
        public static partial void ConnectionDisposed(ILogger logger);

        [LoggerMessage(15, LogLevel.Error, "Exception occurred while adding missed messages to queue.",
            EventName = "ErrorAddMissedMessages")]
        public static partial void ErrorAddMissedMessages(ILogger logger, Exception exception);

        [LoggerMessage(16, LogLevel.Warning, "Received invalid message: {Message}",
            EventName = "InvalidMessageReceived")]
        private static partial void InvalidMessageReceivedCore(ILogger logger, string message);

        /// <summary>Logs an unparseable message, with the body logged in full apart from any embedded credential.</summary>
        public static void InvalidMessageReceived(ILogger logger, string message)
            => InvalidMessageReceivedCore(logger, Redaction.HideCredentials(message));
    }
}
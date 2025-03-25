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
        public static partial void NotificationReceived(ILogger logger, string channel, int pid, string payload);

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
        public static partial void ErrorConsumeMessage(ILogger logger, string message, Exception exception);

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
        public static partial void InvalidMessageReceived(ILogger logger, string message);
    }
}
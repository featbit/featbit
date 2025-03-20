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
            "Listening stopped due to connection closed. Will restart in {RestartIntervalInSeconds} seconds.",
            EventName = "ListenStoppedDueToConnectionClosed")]
        public static partial void ListenStoppedDueToConnectionClosed(ILogger logger, int restartIntervalInSeconds);

        [LoggerMessage(7, LogLevel.Warning, "No message handler for channel: {Channel}",
            EventName = "NoHandlerForChannel")]
        public static partial void NoHandlerForChannel(ILogger logger, string channel);

        [LoggerMessage(8, LogLevel.Debug, "Message handled: {Message}", EventName = "MessageHandled")]
        public static partial void MessageHandled(ILogger logger, string message);

        [LoggerMessage(9, LogLevel.Error, "Exception occurred while consuming message: {Message}.",
            EventName = "ErrorConsumeMessage")]
        public static partial void ErrorConsumeMessage(ILogger logger, string message, Exception exception);

        [LoggerMessage(10, LogLevel.Information, "Listening stopped.", EventName = "ListeningStopped")]
        public static partial void ListeningStopped(ILogger logger);

        [LoggerMessage(11, LogLevel.Error, "Exception occurred while starting listening.",
            EventName = "ErrorStartListening")]
        public static partial void ErrorStartListening(ILogger logger, Exception exception);

        [LoggerMessage(12, LogLevel.Error, "Exception occurred while disposing current connection.",
            EventName = "ErrorDisposeConnection")]
        public static partial void ErrorDisposeConnection(ILogger logger, Exception exception);

        [LoggerMessage(13, LogLevel.Error, "Exception occurred while adding missing messages to queue.",
            EventName = "ErrorAddMissingMessages")]
        public static partial void ErrorAddMissingMessages(ILogger logger, Exception exception);
    }
}
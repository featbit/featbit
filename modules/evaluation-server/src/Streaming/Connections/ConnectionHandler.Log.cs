using Microsoft.Extensions.Logging;

namespace Streaming.Connections;

public partial class ConnectionHandler
{
    public static class Log
    {
        public static void ErrorProcessMessage(ILogger logger, Connection connection, Exception exception) =>
            _errorProcessMessage(logger, connection.ProjectKey, connection.EnvKey, connection.ClientIpAddress,
                connection.ClientHost, connection.Id, exception);

        public static void ReceiveEmptyMessage(ILogger logger, Connection connection) =>
            _receiveEmptyMessage(logger, connection.ProjectKey, connection.EnvKey, connection.ClientIpAddress,
                connection.ClientHost, connection.Id, null);

        public static void ReceiveCloseMessage(ILogger logger, Connection connection) =>
            _receiveCloseMessage(logger, connection.ProjectKey, connection.EnvKey, connection.ClientIpAddress,
                connection.ClientHost, connection.Id, null);

        public static void ErrorReadMessage(ILogger logger, Connection connection, string error) =>
            _errorReadMessage(logger, connection.ProjectKey, connection.EnvKey, connection.ClientIpAddress,
                connection.ClientHost, connection.Id, error, null);

        public static void CannotFindMessageHandler(ILogger logger, Connection connection, string messageType) =>
            _cannotFindMessageHandler(logger, connection.ProjectKey, connection.EnvKey, connection.ClientIpAddress,
                connection.ClientHost, connection.Id, messageType, null);

        public static void ReceiveInvalidMessage(ILogger logger, Connection connection, string message,
            Exception exception) =>
            _receiveInvalidMessage(logger, connection.ProjectKey, connection.EnvKey, connection.ClientIpAddress,
                connection.ClientHost, connection.Id, message, exception);

        public static void ErrorHandleMessage(ILogger logger, Connection connection, string message,
            Exception exception) =>
            _errorHandleMessage(logger, connection.ProjectKey, connection.EnvKey, connection.ClientIpAddress,
                connection.ClientHost, connection.Id, message, exception);

        private static readonly Action<ILogger, string, string, string, string, string, Exception?>
            _errorProcessMessage = LoggerMessage.Define<string, string, string, string, string>(
                LogLevel.Error,
                new EventId(1, "ErrorProcessMessage"),
                "[{ProjectKey}:{EnvKey}:{ClientIpAddress}:{ClientHost}:{ConnectionId}] An exception occurred while processing message."
            );

        private static readonly Action<ILogger, string, string, string, string, string, Exception?>
            _receiveEmptyMessage = LoggerMessage.Define<string, string, string, string, string>(
                LogLevel.Trace,
                new EventId(2, "ReceiveEmptyMessage"),
                "[{ProjectKey}:{EnvKey}:{ClientIpAddress}:{ClientHost}:{ConnectionId}] Received empty message."
            );

        private static readonly Action<ILogger, string, string, string, string, string, Exception?>
            _receiveCloseMessage =
                LoggerMessage.Define<string, string, string, string, string>(
                    LogLevel.Trace,
                    new EventId(3, "ReceiveCloseMessage"),
                    "[{ProjectKey}:{EnvKey}:{ClientIpAddress}:{ClientHost}:{ConnectionId}] Received close message."
                );

        private static readonly Action<ILogger, string, string, string, string, string, string, Exception?>
            _errorReadMessage =
                LoggerMessage.Define<string, string, string, string, string, string>(
                    LogLevel.Warning,
                    new EventId(4, "ErrorReadMessage"),
                    "[{ProjectKey}:{EnvKey}:{ClientIpAddress}:{ClientHost}:{ConnectionId}] An error occurred while reading message, Error: {Error}."
                );

        private static readonly Action<ILogger, string, string, string, string, string, string, Exception?>
            _cannotFindMessageHandler = LoggerMessage.Define<string, string, string, string, string, string>(
                LogLevel.Warning,
                new EventId(5, "CannotFindMessageHandler"),
                "[{ProjectKey}:{EnvKey}:{ClientIpAddress}:{ClientHost}:{ConnectionId}] Cannot find message handler for type {MessageType}."
            );

        private static readonly Action<ILogger, string, string, string, string, string, string, Exception?>
            _receiveInvalidMessage = LoggerMessage.Define<string, string, string, string, string, string>(
                LogLevel.Warning,
                new EventId(6, "ReceiveInvalidMessage"),
                "[{ProjectKey}:{EnvKey}:{ClientIpAddress}:{ClientHost}:{ConnectionId}] Received invalid message: {Message}."
            );

        private static readonly Action<ILogger, string, string, string, string, string, string, Exception?>
            _errorHandleMessage = LoggerMessage.Define<string, string, string, string, string, string>(
                LogLevel.Error,
                new EventId(7, "ErrorHandleMessage"),
                "[{ProjectKey}:{EnvKey}:{ClientIpAddress}:{ClientHost}:{ConnectionId}] Failed handle message: {Message}."
            );
    }
}
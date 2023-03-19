using Microsoft.Extensions.Logging;

namespace Domain.WebSockets;

public partial class ConnectionHandler
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Error, "{ConnectionId}: exception occurred when process message. {Error}", EventName = "ErrorProcessMessage")]
        public static partial void ErrorProcessMessage(ILogger logger, string connectionId, string error);
        
        [LoggerMessage(2, LogLevel.Trace, "{ConnectionId}: receive empty message", EventName = "ReceiveEmptyMessage")]
        public static partial void ReceiveEmptyMessage(ILogger logger, string connectionId);

        [LoggerMessage(3, LogLevel.Trace, "{ConnectionId}: receive close message", EventName = "ReceiveCloseMessage")]
        public static partial void ReceiveCloseMessage(ILogger logger, string connectionId);
        
        [LoggerMessage(4, LogLevel.Warning, "{ConnectionId}: error occurred while read message. {Error}", EventName = "ErrorReadMessage")]
        public static partial void ErrorReadMessage(ILogger logger, string connectionId, string error);
        
        [LoggerMessage(5, LogLevel.Warning, "{ConnectionId}: receive invalid message.", EventName = "ReceiveInvalidMessage")]
        public static partial void ReceiveInvalidMessage(ILogger logger, string connectionId, Exception exception);

        [LoggerMessage(6, LogLevel.Error, "{ConnectionId}: failed handle message.", EventName = "ErrorHandleMessage")]
        public static partial void ErrorHandleMessage(ILogger logger, string connectionId, Exception exception);

        [LoggerMessage(7, LogLevel.Warning, "{ConnectionId}: cannot find message handler for type {MessageType}", EventName = "CannotFindMessageHandler")]
        public static partial void CannotFindMessageHandler(ILogger logger, string connectionId, string messageType);
    }
}
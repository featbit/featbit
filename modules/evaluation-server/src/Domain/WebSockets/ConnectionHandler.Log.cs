using Microsoft.Extensions.Logging;

namespace Domain.WebSockets;

public partial class ConnectionHandler
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Error, "{ConnectionId}: exception occured when process message. {Error}", EventName = "ErrorProcessMessage")]
        public static partial void ErrorProcessMessage(ILogger logger, string connectionId, string error);
        
        [LoggerMessage(2, LogLevel.Trace, "{ConnectionId}: receive empty message", EventName = "ReceiveEmptyMessage")]
        public static partial void ReceiveEmptyMessage(ILogger logger, string connectionId);

        [LoggerMessage(3, LogLevel.Trace, "{ConnectionId}: receive close message", EventName = "ReceiveCloseMessage")]
        public static partial void ReceiveCloseMessage(ILogger logger, string connectionId);
        
        [LoggerMessage(4, LogLevel.Warning, "{ConnectionId}: error occured while read message. {Error}", EventName = "ErrorReadMessage")]
        public static partial void ErrorReadMessage(ILogger logger, string connectionId, string error);
    }
}
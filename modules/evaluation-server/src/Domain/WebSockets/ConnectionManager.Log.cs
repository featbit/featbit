using Microsoft.Extensions.Logging;

namespace Domain.WebSockets;

partial class ConnectionManager
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Trace, "{ConnectionId}: connection registered. Details: {Details}", EventName = "ConnectionRegistered")]
        public static partial void ConnectionRegistered(ILogger logger, string connectionId, string details);
        
        [LoggerMessage(2, LogLevel.Trace, "{ConnectionId}: connection removed", EventName = "ConnectionRemoved")]
        public static partial void ConnectionRemoved(ILogger logger, string connectionId);
    }
}
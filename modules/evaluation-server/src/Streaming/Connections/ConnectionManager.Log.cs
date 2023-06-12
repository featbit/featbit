using Microsoft.Extensions.Logging;

namespace Streaming.Connections;

partial class ConnectionManager
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Trace, "{ConnectionId}: connection added. Details: {Details}", EventName = "ConnectionAdded")]
        public static partial void ConnectionAdded(ILogger logger, string connectionId, string details);

        [LoggerMessage(2, LogLevel.Trace, "{ConnectionId}: connection removed.", EventName = "ConnectionRemoved")]
        public static partial void ConnectionRemoved(ILogger logger, string connectionId);
    }
}
using Microsoft.Extensions.Logging;

namespace Streaming.Connections;

partial class ConnectionManager
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Trace, "Connection added", EventName = "ConnectionAdded")]
        public static partial void ConnectionAdded(
            ILogger logger,
            [TagProvider(typeof(ConnectionContextTagProvider), nameof(ConnectionContextTagProvider.RecordTags))]
            ConnectionContext connection
        );

        [LoggerMessage(2, LogLevel.Trace, "Connection removed", EventName = "ConnectionRemoved")]
        public static partial void ConnectionRemoved(
            ILogger logger,
            [TagProvider(typeof(ConnectionContextTagProvider), nameof(ConnectionContextTagProvider.RecordTags))]
            ConnectionContext connection
        );
    }
}
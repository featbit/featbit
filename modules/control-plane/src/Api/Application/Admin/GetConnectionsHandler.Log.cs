using Microsoft.Extensions.Logging;

namespace Api.Application.Admin;

public partial class GetConnectionsHandler
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Warning, "No connected Redis server found.",
            EventName = "NoConnectedRedisServer")]
        public static partial void NoConnectedRedisServer(ILogger logger);

        [LoggerMessage(2, LogLevel.Information, "Found {Count} connection key(s) in Redis.",
            EventName = "FoundConnectionKeys")]
        public static partial void FoundConnectionKeys(ILogger logger, int count);

        [LoggerMessage(3, LogLevel.Error, "Error retrieving connections from Redis.",
            EventName = "ErrorRetrieveConnections")]
        public static partial void ErrorRetrieveConnections(ILogger logger, Exception ex);
    }
}
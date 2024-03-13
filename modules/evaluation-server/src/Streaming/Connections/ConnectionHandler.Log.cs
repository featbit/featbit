using Microsoft.Extensions.Logging;

namespace Streaming.Connections;

public partial class ConnectionHandler
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Error, "{ConnectionId}: exception occurred when process message. {Error} [EnvId: {EnvId}, ClientIP: {ClientIP}, ClientHost: {ClientHost}]", EventName = "ErrorProcessMessage")]
        public static partial void ErrorProcessMessage(ILogger logger, string connectionId, string error, Guid envId, string clientIp, string clientHost);
        
        [LoggerMessage(2, LogLevel.Trace, "{ConnectionId}: receive empty message [EnvId: {EnvId}, ClientIP: {ClientIP}, ClientHost: {ClientHost}]", EventName = "ReceiveEmptyMessage")]
        public static partial void ReceiveEmptyMessage(ILogger logger, string connectionId, Guid envId, string clientIp, string clientHost);

        [LoggerMessage(3, LogLevel.Trace, "{ConnectionId}: receive close message [EnvId: {EnvId}, ClientIP: {ClientIP}, ClientHost: {ClientHost}]", EventName = "ReceiveCloseMessage")]
        public static partial void ReceiveCloseMessage(ILogger logger, string connectionId, Guid envId, string clientIp, string clientHost);
        
        [LoggerMessage(4, LogLevel.Warning, "{ConnectionId}: error occurred while read message. {Error} [EnvId: {EnvId}, ClientIP: {ClientIP}, ClientHost: {ClientHost}]", EventName = "ErrorReadMessage")]
        public static partial void ErrorReadMessage(ILogger logger, string connectionId, string error, Guid envId, string clientIp, string clientHost);
        
        [LoggerMessage(5, LogLevel.Warning, "{ConnectionId}: receive invalid message. [EnvId: {EnvId}, ClientIP: {ClientIP}, ClientHost: {ClientHost}]", EventName = "ReceiveInvalidMessage")]
        public static partial void ReceiveInvalidMessage(ILogger logger, string connectionId, Guid envId, string clientIp, string clientHost, Exception exception);

        [LoggerMessage(6, LogLevel.Error, "{ConnectionId}: failed handle message. [EnvId: {EnvId}, ClientIP: {ClientIP}, ClientHost: {ClientHost}]", EventName = "ErrorHandleMessage")]
        public static partial void ErrorHandleMessage(ILogger logger, string connectionId, Guid envId, string clientIp, string clientHost, Exception exception);

        [LoggerMessage(7, LogLevel.Warning, "{ConnectionId}: cannot find message handler for type {MessageType} [EnvId: {EnvId}, ClientIP: {ClientIP}, ClientHost: {ClientHost}]", EventName = "CannotFindMessageHandler")]
        public static partial void CannotFindMessageHandler(ILogger logger, string connectionId, string messageType, Guid envId, string clientIp, string clientHost);
    }
}
using Microsoft.Extensions.Logging;

namespace Domain.WebSockets;

partial class MessageHandler
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Warning, "{ConnectionId}: receive invalid message.", EventName = "ReceiveInvalidMessage")]
        public static partial void ReceiveInvalidMessage(ILogger logger, string connectionId, Exception exception);

        [LoggerMessage(2, LogLevel.Error, "{ConnectionId}: failed handle message.", EventName = "ErrorHandleMessage")]
        public static partial void ErrorHandleMessage(ILogger logger, string connectionId, Exception exception);
    }
}
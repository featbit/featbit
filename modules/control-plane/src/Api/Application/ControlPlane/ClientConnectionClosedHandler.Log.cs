using Domain.Observability;
using Microsoft.Extensions.Logging;

namespace Api.Application.ControlPlane;

public partial class ClientConnectionClosedHandler
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Information, "Handling connection closed message: {Message}",
            EventName = "HandlingConnectionClosed")]
        private static partial void HandlingConnectionClosedCore(ILogger logger, string message);

        /// <summary>
        /// Logs an inbound connection-closed message. <c>ConnectionMessage</c> carries the client's SDK
        /// secret, so the body is logged in full with any embedded credential hashed
        /// (<c>docs/observability/index.md</c> section 7).
        /// </summary>
        public static void HandlingConnectionClosed(ILogger logger, string message)
            => HandlingConnectionClosedCore(logger, Redaction.HideCredentials(message));

        [LoggerMessage(2, LogLevel.Error, "Failed to deserialize connection message: {Message}",
            EventName = "ErrorDeserializeConnection")]
        private static partial void ErrorDeserializeConnectionCore(
            ILogger logger, string message, Exception exception);

        /// <summary>Logs a deserialization failure, with any embedded credential hashed.</summary>
        public static void ErrorDeserializeConnection(ILogger logger, string message, Exception exception)
            => ErrorDeserializeConnectionCore(logger, Redaction.HideCredentials(message), exception);

        [LoggerMessage(3, LogLevel.Error, "Connection message is null after deserialization: {Message}",
            EventName = "ConnectionNull")]
        private static partial void ConnectionNullCore(ILogger logger, string message);

        /// <summary>Logs a null deserialization result, with any embedded credential hashed.</summary>
        public static void ConnectionNull(ILogger logger, string message)
            => ConnectionNullCore(logger, Redaction.HideCredentials(message));

        [LoggerMessage(4, LogLevel.Error, "Connection id is null or empty: {Message}",
            EventName = "ConnectionIdMissing")]
        private static partial void ConnectionIdMissingCore(ILogger logger, string message);

        /// <summary>Logs a missing connection id, with any embedded credential hashed.</summary>
        public static void ConnectionIdMissing(ILogger logger, string message)
            => ConnectionIdMissingCore(logger, Redaction.HideCredentials(message));

        [LoggerMessage(5, LogLevel.Error, "Connection secret is null or empty. Connection: {ConnectionId}",
            EventName = "ConnectionSecretMissing")]
        public static partial void ConnectionSecretMissing(ILogger logger, string connectionId);

        [LoggerMessage(6, LogLevel.Error, "Connection env id is empty. Connection: {ConnectionId}",
            EventName = "ConnectionEnvIdMissing")]
        public static partial void ConnectionEnvIdMissing(ILogger logger, string connectionId);
    }
}

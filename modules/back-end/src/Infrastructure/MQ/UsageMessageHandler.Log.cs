using Domain.Observability;
using Microsoft.Extensions.Logging;

namespace Infrastructure.MQ;

public partial class UsageMessageHandler
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Warning, "Received invalid usage message: {Message}",
            EventName = "InvalidUsageMessage")]
        private static partial void InvalidUsageMessageCore(ILogger logger, string message);

        /// <summary>
        /// Logs an invalid usage message. Logged in full: the end-user identifiers it carries are
        /// exactly what makes an invalid usage message diagnosable (<c>docs/observability/index.md</c> section 7).
        /// Any embedded credential is hashed.
        /// </summary>
        public static void InvalidUsageMessage(ILogger logger, string message)
            => InvalidUsageMessageCore(logger, Redaction.HideCredentials(message));
    }
}
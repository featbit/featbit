using Microsoft.Extensions.Logging;

namespace Infrastructure.Services;

public partial class WebhookSender
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Warning,
            "Blocked webhook request to '{Url}' due to AntiSSRF policy: {Message}",
            EventName = "BlockedByAntiSsrf")]
        public static partial void BlockedByAntiSsrf(ILogger logger, string url, string message);

        [LoggerMessage(2, LogLevel.Error, "Exception occurred while sending webhook '{Name}'",
            EventName = "ErrorSendWebhook")]
        public static partial void ErrorSendWebhook(ILogger logger, string name, Exception ex);

        [LoggerMessage(3, LogLevel.Error, "Failed to add webhook delivery log",
            EventName = "ErrorAddDeliveryLog")]
        public static partial void ErrorAddDeliveryLog(ILogger logger, Exception ex);
    }
}

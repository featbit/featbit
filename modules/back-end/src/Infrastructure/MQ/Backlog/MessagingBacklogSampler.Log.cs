using Microsoft.Extensions.Logging;

namespace Infrastructure.MQ.Backlog;

public sealed partial class MessagingBacklogSampler
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Warning,
            "Backlog sampling failed for provider {Provider}; depth reported as unknown.",
            EventName = "BacklogSampleFailed")]
        public static partial void BacklogSampleFailed(ILogger logger, string provider, Exception ex);
    }
}
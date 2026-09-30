using Microsoft.Extensions.Logging;

namespace Infrastructure.MQ.Backlog;

public sealed partial class MessagingBacklogSampler
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Warning,
            "Backlog sampling failed for provider {Provider}; depth reported as unknown.",
            EventName = "BacklogSamplingFailed")]
        public static partial void SamplingFailed(ILogger logger, string provider, Exception ex);
    }
}

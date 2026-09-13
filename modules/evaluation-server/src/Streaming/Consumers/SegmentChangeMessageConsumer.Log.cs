using Microsoft.Extensions.Logging;

namespace Streaming.Consumers;

public partial class SegmentChangeMessageConsumer
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Error,
            "Exception occurred while processing segment change message for connection {ConnectionId} in env {EnvId}.",
            EventName = "SegmentChangeProcessingFailed")]
        public static partial void ProcessingFailed(ILogger logger, string connectionId, Guid envId, Exception ex);
    }
}

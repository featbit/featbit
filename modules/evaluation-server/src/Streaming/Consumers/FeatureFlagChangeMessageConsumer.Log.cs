using Microsoft.Extensions.Logging;

namespace Streaming.Consumers;

public partial class FeatureFlagChangeMessageConsumer
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Error,
            "Exception occurred while processing feature flag change message for connection {ConnectionId} in env {EnvId}.",
            EventName = "FeatureFlagChangeProcessingFailed")]
        public static partial void ProcessingFailed(ILogger logger, string connectionId, Guid envId, Exception ex);
    }
}

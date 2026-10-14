using Microsoft.Extensions.Logging;

namespace Infrastructure.MQ.Kafka;

public sealed partial class KafkaConsumerGroupHealthCheck
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Warning, "Kafka consumer-group diagnostic check failed.",
            EventName = "DiagnosticCheckFailed")]
        public static partial void DiagnosticCheckFailed(ILogger logger, Exception ex);
    }
}
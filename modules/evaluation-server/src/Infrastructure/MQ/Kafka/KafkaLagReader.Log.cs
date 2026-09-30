using Confluent.Kafka;
using Microsoft.Extensions.Logging;

namespace Infrastructure.MQ.Kafka;

public sealed partial class KafkaLagReader
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Debug, "Kafka lag reader reported {ErrorCode}.",
            EventName = "KafkaLagReaderError")]
        public static partial void ReaderReportedError(ILogger logger, ErrorCode errorCode);
    }
}

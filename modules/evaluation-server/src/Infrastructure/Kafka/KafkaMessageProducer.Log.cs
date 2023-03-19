using Microsoft.Extensions.Logging;

namespace Infrastructure.Kafka;

public partial class KafkaMessageProducer
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Error, "Exception occurred when publish message.", EventName = "ErrorPublishMessage")]
        public static partial void ErrorPublishMessage(ILogger logger, Exception exception);

        [LoggerMessage(2, LogLevel.Error, "Error occurred when delivery message. Topic: {Topic}, Value: {Value}, Error: {Error}", EventName = "ErrorDeliveryMessage")]
        public static partial void ErrorDeliveryMessage(ILogger logger, string topic, string value, string error);
    }
}
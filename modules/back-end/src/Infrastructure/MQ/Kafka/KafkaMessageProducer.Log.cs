using Domain.Observability;
using Microsoft.Extensions.Logging;

namespace Infrastructure.MQ.Kafka;

public partial class KafkaMessageProducer
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Error, "Exception occured when publish message.", EventName = "ErrorPublishMessage")]
        public static partial void ErrorPublishMessage(ILogger logger, Exception exception);

        [LoggerMessage(2, LogLevel.Error, "Error occured when delivery message. Topic: {Topic}, Value: {Value}, Error: {Error}", EventName = "ErrorDeliveryMessage")]
        private static partial void ErrorDeliveryMessageCore(ILogger logger, string topic, string value, string error);

        /// <summary>
        /// Logs a delivery failure. The value is the serialized message body, which carries flag
        /// rules, end-user attributes, and SDK secrets, so it is logged in full with any embedded credential hashed
        /// (<c>docs/observability/index.md</c> §7).
        /// </summary>
        public static void ErrorDeliveryMessage(ILogger logger, string topic, string value, string error)
            => ErrorDeliveryMessageCore(logger, topic, Redaction.HideCredentials(value), error);
    }
}
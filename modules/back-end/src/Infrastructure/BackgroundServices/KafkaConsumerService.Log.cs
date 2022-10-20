using Microsoft.Extensions.Logging;

namespace Infrastructure.BackgroundServices;

partial class KafkaConsumerService
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Error, "Exception occured when consume message.", EventName = "ErrorConsumeMessage")]
        public static partial void ErrorConsumeMessage(ILogger logger, Exception exception);

        [LoggerMessage(2, LogLevel.Error, "Failed consume message. Error: {Error}", EventName = "FailedConsumeMessage")]
        public static partial void FailedConsumeMessage(ILogger logger, string error);
    }
}
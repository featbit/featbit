using Microsoft.Extensions.Logging;

namespace Infrastructure.Services.MongoDb;

public partial class SegmentService
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Error, "Segment scope '{Scope}' is not a valid RN.",
            EventName = "InvalidScope")]
        public static partial void InvalidScope(ILogger logger, string scope);
    }
}
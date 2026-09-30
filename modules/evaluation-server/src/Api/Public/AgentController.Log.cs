using Microsoft.Extensions.Logging;

namespace Api.Public;

public partial class AgentController
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Error, "Exception occurred while registering agent.",
            EventName = "AgentRegisterFailed")]
        public static partial void RegisterFailed(ILogger logger, Exception ex);
    }
}

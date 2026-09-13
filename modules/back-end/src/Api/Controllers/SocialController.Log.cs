using Microsoft.Extensions.Logging;

namespace Api.Controllers;

public partial class SocialController
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Error, "Exception occurred when performing OAuth login.",
            EventName = "ErrorOAuthLogin")]
        public static partial void ErrorOAuthLogin(ILogger logger, Exception ex);
    }
}
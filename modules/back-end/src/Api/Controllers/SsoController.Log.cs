using Microsoft.Extensions.Logging;

namespace Api.Controllers;

public partial class SsoController
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Error, "Exception occurred when login by oidc code",
            EventName = "ErrorOidcLogin")]
        public static partial void ErrorOidcLogin(ILogger logger, Exception ex);
    }
}
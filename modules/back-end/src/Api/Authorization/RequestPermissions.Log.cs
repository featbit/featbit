using Microsoft.Extensions.Logging;

namespace Api.Authorization;

public partial class RequestPermissions
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Warning, "Malformed user id claim in JWT token.",
            EventName = "MalformedUserIdClaim")]
        public static partial void MalformedUserIdClaim(ILogger logger);

        [LoggerMessage(2, LogLevel.Warning, "Malformed or missing organization id in request headers.",
            EventName = "MalformedOrganizationId")]
        public static partial void MalformedOrganizationId(ILogger logger);

        [LoggerMessage(3, LogLevel.Warning, "Access token not found in HttpContext.Items.",
            EventName = "AccessTokenNotFound")]
        public static partial void AccessTokenNotFound(ILogger logger);
    }
}

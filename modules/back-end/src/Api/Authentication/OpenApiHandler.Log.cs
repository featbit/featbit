using Microsoft.Extensions.Logging;

namespace Api.Authentication;

public partial class OpenApiHandler
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Warning, "Failed to refresh LastUsedAt for access token {AccessTokenId}",
            EventName = "ErrorRefreshLastUsedAt")]
        public static partial void ErrorRefreshLastUsedAt(ILogger logger, Guid accessTokenId, Exception ex);
    }
}
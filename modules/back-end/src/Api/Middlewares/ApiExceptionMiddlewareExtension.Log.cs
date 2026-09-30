using Microsoft.Extensions.Logging;

namespace Api.Middlewares;

public static partial class ApiExceptionMiddlewareExtension
{
    private static partial class Log
    {
        /// <summary>
        /// An expected, client-caused failure. Logged at Warning because it is actionable for the
        /// caller but is not a server fault; the exception is attached so the stack is available.
        /// </summary>
        [LoggerMessage(1, LogLevel.Warning, "Request {Method} {Path} failed with status {StatusCode}.",
            EventName = "RequestFailed")]
        public static partial void RequestFailed(
            ILogger logger, string method, string path, int statusCode, Exception exception);

        /// <summary>
        /// Validation failures log their error <i>codes</i> only. The offending values are user
        /// input and may be personal data, so they are never logged.
        /// </summary>
        [LoggerMessage(2, LogLevel.Warning, "Request {Method} {Path} failed validation. Errors: {ErrorCodes}",
            EventName = "RequestValidationFailed")]
        public static partial void RequestValidationFailed(
            ILogger logger, string method, string path, string errorCodes);

        /// <summary>An unanticipated server fault — the case that previously produced a silent 500.</summary>
        [LoggerMessage(3, LogLevel.Error, "Unhandled exception processing {Method} {Path}.",
            EventName = "RequestUnhandledException")]
        public static partial void RequestUnhandledException(
            ILogger logger, string method, string path, Exception exception);
    }
}

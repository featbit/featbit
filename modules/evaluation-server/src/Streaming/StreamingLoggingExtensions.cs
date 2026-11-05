using Microsoft.Extensions.Logging;

namespace Streaming;

internal static partial class StreamingLoggingExtensions
{
    [LoggerMessage(1, LogLevel.Warning, "Streaming request was rejected. Reason: {Reason}.",
        EventName = "RequestRejected")]
    public static partial void RequestRejected(this ILogger logger, string reason);

    [LoggerMessage(2, LogLevel.Debug, "Failed to resolve host for IP address: {IpAddress}.",
        EventName = "FailedToResolveHost")]
    public static partial void FailedToResolveHost(this ILogger logger, string ipAddress, Exception ex);

    [LoggerMessage(3, LogLevel.Error, "Exception occurred while validating request.",
        EventName = "ErrorValidateRequest")]
    public static partial void ErrorValidateRequest(this ILogger logger, Exception ex);

    [LoggerMessage(4, LogLevel.Error, "Exception occurred while looking up relay proxy token.",
        EventName = "ErrorLookupRelayProxyToken")]
    public static partial void ErrorLookupRelayProxyToken(this ILogger logger, Exception ex);

    [LoggerMessage(5, LogLevel.Error, "Exception occurred while looking up secret token.",
        EventName = "ErrorLookupSecretToken")]
    public static partial void ErrorLookupSecretToken(this ILogger logger, Exception ex);

    [LoggerMessage(6, LogLevel.Warning, "Streaming request validation unavailable. Reason: {Reason}.",
        EventName = "RequestValidationUnavailable")]
    public static partial void RequestValidationUnavailable(this ILogger logger, string reason);

    [LoggerMessage(7, LogLevel.Error, "Failed to parse token.",
        EventName = "FailedToParseToken")]
    public static partial void FailedToParseToken(this ILogger logger, Exception ex);
}
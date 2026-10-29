using Microsoft.Extensions.Logging;

namespace Streaming;

internal static partial class StreamingLoggingExtensions
{
    [LoggerMessage(1, LogLevel.Warning, "Streaming request was rejected: {RequestId}. Reason: {Reason}.",
        EventName = "RequestRejected")]
    public static partial void RequestRejected(this ILogger logger, string? requestId, string reason);

    [LoggerMessage(2, LogLevel.Warning, "Failed to resolve host for IP address: {IpAddress}.",
        EventName = "FailedToResolveHost")]
    public static partial void FailedToResolveHost(this ILogger logger, string ipAddress, Exception ex);

    [LoggerMessage(3, LogLevel.Error, "Exception occurred while validating request: {RequestId}.",
        EventName = "ErrorValidateRequest")]
    public static partial void ErrorValidateRequest(this ILogger logger, string? requestId, Exception ex);

    [LoggerMessage(4, LogLevel.Error, "Exception occurred while looking up relay proxy token for request: {RequestId}.",
        EventName = "ErrorLookupRelayProxyToken")]
    public static partial void ErrorLookupRelayProxyToken(this ILogger logger, string? requestId, Exception ex);

    [LoggerMessage(5, LogLevel.Error, "Exception occurred while looking up secret token for request: {RequestId}.",
        EventName = "ErrorLookupSecretToken")]
    public static partial void ErrorLookupSecretToken(this ILogger logger, string? requestId, Exception ex);

    [LoggerMessage(6, LogLevel.Warning, "Streaming request validation unavailable: {RequestId}. Reason: {Reason}.",
        EventName = "RequestValidationUnavailable")]
    public static partial void RequestValidationUnavailable(this ILogger logger, string? requestId, string reason);

    [LoggerMessage(7, LogLevel.Error, "Failed to parse token for request: {RequestId}.",
        EventName = "FailedToParseToken")]
    public static partial void FailedToParseToken(this ILogger logger, string? requestId, Exception ex);
}
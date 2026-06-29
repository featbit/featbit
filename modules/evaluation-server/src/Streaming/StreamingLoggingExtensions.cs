using Microsoft.Extensions.Logging;

namespace Streaming;

internal static partial class StreamingLoggingExtensions
{
    [LoggerMessage(1, LogLevel.Warning, "Streaming request was rejected: {Request}. Reason: {Reason}.",
        EventName = "RequestRejected")]
    public static partial void RequestRejected(this ILogger logger, string? request, string reason);

    [LoggerMessage(2, LogLevel.Warning, "Failed to resolve host for IP address: {IpAddress}.",
        EventName = "FailedToResolveHost")]
    public static partial void FailedToResolveHost(this ILogger logger, string ipAddress, Exception ex);

    [LoggerMessage(3, LogLevel.Error, "Exception occurred while validating request: {Request}.",
        EventName = "ErrorValidateRequest")]
    public static partial void ErrorValidateRequest(this ILogger logger, string? request, Exception ex);

    [LoggerMessage(4, LogLevel.Error, "Exception occurred while looking up relay proxy token: {Token}.",
        EventName = "ErrorLookupRelayProxyToken")]
    public static partial void ErrorLookupRelayProxyToken(this ILogger logger, string? token, Exception ex);

    [LoggerMessage(5, LogLevel.Error, "Exception occurred while looking up secret token: {Token}.",
        EventName = "ErrorLookupSecretToken")]
    public static partial void ErrorLookupSecretToken(this ILogger logger, string? token, Exception ex);

    [LoggerMessage(6, LogLevel.Warning, "Streaming request validation unavailable: {Request}. Reason: {Reason}.",
        EventName = "RequestValidationUnavailable")]
    public static partial void RequestValidationUnavailable(this ILogger logger, string? request, string reason);
}
using Microsoft.Extensions.Logging;

namespace Streaming;

internal static partial class StreamingLoggingExtensions
{
    [LoggerMessage(1, LogLevel.Warning, "Streaming request was rejected: {Request}. Reason: {Reason}.",
        EventName = "RequestRejected")]
    public static partial void RequestRejected(this ILogger logger, string? request, string reason);

    [LoggerMessage(2, LogLevel.Error, "Failed to resolve host for IP address: {IpAddress}.",
        EventName = "FailedToResolveHost")]
    public static partial void FailedToResolveHost(this ILogger logger, string ipAddress);

    [LoggerMessage(3, LogLevel.Error, "Exception occurred while validating request: {Request}.",
        EventName = "ErrorValidateRequest")]
    public static partial void ErrorValidateRequest(this ILogger logger, string? request, Exception ex);
}
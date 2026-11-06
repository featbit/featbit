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

    [LoggerMessage(6, LogLevel.Error, "Streaming request validation unavailable. Reason: {Reason}.",
        EventName = "RequestValidationUnavailable")]
    public static partial void RequestValidationUnavailable(this ILogger logger, string reason, Exception? ex);
}

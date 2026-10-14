using Domain.Observability;
using Microsoft.Extensions.Logging;

namespace Streaming;

/// <summary>
/// Streaming log events.
/// </summary>
/// <remarks>
/// <para>
/// Every event that would otherwise carry a credential is declared as a <b>private</b>
/// source-generated method behind a public wrapper that redacts first. Redacting at the call sites
/// instead would only hold until the next caller forgot, and a credential leak that depends on
/// everyone remembering is a leak. Here it is not possible to log these events unredacted.
/// </para>
/// <para>
/// Event IDs and names are unchanged, so alerting keyed on them keeps working. See
/// <c>docs/observability/index.md</c> §7.
/// </para>
/// </remarks>
internal static partial class StreamingLoggingExtensions
{
    /// <summary>
    /// Logs a rejected streaming request. Keys and ordinary values are kept; only the SDK token the
    /// query string carries is hashed.
    /// </summary>
    public static void RequestRejected(this ILogger logger, string? request, string reason)
        => RequestRejectedCore(logger, Redaction.QueryString(request), reason);

    /// <summary>Logs a failure to reverse-resolve a client address.</summary>
    public static void FailedToResolveHost(this ILogger logger, string ipAddress, Exception ex)
        => FailedToResolveHostCore(logger, ipAddress, ex);

    /// <summary>Logs an unexpected failure while validating a streaming request.</summary>
    public static void ErrorValidateRequest(this ILogger logger, string? request, Exception ex)
        => ErrorValidateRequestCore(logger, Redaction.QueryString(request), ex);

    /// <summary>Logs a failure to look up a relay-proxy token.</summary>
    public static void ErrorLookupRelayProxyToken(this ILogger logger, string? token, Exception ex)
        => ErrorLookupRelayProxyTokenCore(logger, Redaction.Token(token), ex);

    /// <summary>Logs a failure to look up an SDK secret.</summary>
    public static void ErrorLookupSecretToken(this ILogger logger, string? token, Exception ex)
        => ErrorLookupSecretTokenCore(logger, Redaction.Token(token), ex);

    /// <summary>Logs a streaming request that could not be validated for a transient reason.</summary>
    public static void RequestValidationUnavailable(this ILogger logger, string? request, string reason)
        => RequestValidationUnavailableCore(logger, Redaction.QueryString(request), reason);

    /// <summary>Logs a token that could not be parsed.</summary>
    public static void FailedToParseToken(this ILogger logger, string? token, Exception ex)
        => FailedToParseTokenCore(logger, Redaction.Token(token), ex);

    [LoggerMessage(1, LogLevel.Warning, "Streaming request was rejected: {Request}. Reason: {Reason}.",
        EventName = "RequestRejected")]
    private static partial void RequestRejectedCore(ILogger logger, string? request, string reason);

    [LoggerMessage(2, LogLevel.Warning, "Failed to resolve host for IP address: {IpAddress}.",
        EventName = "FailedToResolveHost")]
    private static partial void FailedToResolveHostCore(ILogger logger, string ipAddress, Exception ex);

    [LoggerMessage(3, LogLevel.Error, "Exception occurred while validating request: {Request}.",
        EventName = "ErrorValidateRequest")]
    private static partial void ErrorValidateRequestCore(ILogger logger, string? request, Exception ex);

    [LoggerMessage(4, LogLevel.Error, "Exception occurred while looking up relay proxy token: {Token}.",
        EventName = "ErrorLookupRelayProxyToken")]
    private static partial void ErrorLookupRelayProxyTokenCore(ILogger logger, string? token, Exception ex);

    [LoggerMessage(5, LogLevel.Error, "Exception occurred while looking up secret token: {Token}.",
        EventName = "ErrorLookupSecretToken")]
    private static partial void ErrorLookupSecretTokenCore(ILogger logger, string? token, Exception ex);

    [LoggerMessage(6, LogLevel.Warning, "Streaming request validation unavailable: {Request}. Reason: {Reason}.",
        EventName = "RequestValidationUnavailable")]
    private static partial void RequestValidationUnavailableCore(ILogger logger, string? request, string reason);

    [LoggerMessage(7, LogLevel.Error, "Failed to parse token: {Token}.",
        EventName = "FailedToParseToken")]
    private static partial void FailedToParseTokenCore(ILogger logger, string? token, Exception ex);
}

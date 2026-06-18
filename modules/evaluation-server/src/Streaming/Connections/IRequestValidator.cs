using Microsoft.AspNetCore.Http;

namespace Streaming.Connections;

/// <summary>
/// Validates streaming requests pre-accept (before accepting the WebSocket).
/// Validates token structure, expiry, and secret availability in the store.
/// </summary>
public interface IRequestValidator
{
    /// <summary>
    /// Validates the streaming request from the HttpContext (type, version, token from query string).
    /// Called pre-accept: before accepting the WebSocket.
    /// </summary>
    Task<ValidationResult> ValidateAsync(HttpContext httpContext);
}
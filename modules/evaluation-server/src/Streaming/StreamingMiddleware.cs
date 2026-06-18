using System.Net.WebSockets;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Streaming.Connections;
using Streaming.Messages;

namespace Streaming;

/// <summary>
/// Streaming middleware: handle WebSocket upgrade and connection lifecycle.
/// Pre-accept validation flow:
/// 1. Validate request (HttpContext, query params).
/// 2. Always accept the WebSocket, then on failure close with a status code SDKs understand:
///    - Invalid (permanent): close with 4003 so SDKs stop reconnecting.
///    - Unavailable (transient): close with a non-4003 status (InternalServerError/1011) so SDKs reconnect.
/// 3. On Valid: accept WebSocket and process the connection.
/// 4. Close connection.
/// </summary>
public class StreamingMiddleware(
    IHostApplicationLifetime applicationLifetime,
    ILogger<StreamingMiddleware> logger,
    RequestDelegate next)
{
    public async Task InvokeAsync(
        HttpContext httpContext,
        IRequestValidator requestValidator,
        MessageDispatcher dispatcher,
        IConnectionManager connectionManager)
    {
        // if not streaming request
        if (!StreamingHelper.IsStreamingRequest(httpContext))
        {
            await next.Invoke(httpContext);
            return;
        }

        // Validate request PRE-accept (before accepting WebSocket)
        var validationResult = await requestValidator.ValidateAsync(httpContext);

        if (validationResult.Status == ValidationResultStatus.Invalid)
        {
            // Protocol requirement: accept first, then close with 4003 so SDKs stop reconnecting.
            using var invalidWebSocket = await httpContext.WebSockets.AcceptWebSocketAsync();
            logger.RequestRejected(httpContext.Request.QueryString.Value, validationResult.Reason);
            await invalidWebSocket.CloseOutputAsync(
                (WebSocketCloseStatus)4003,
                "invalid request, close by server",
                CancellationToken.None
            );
            return;
        }

        if (validationResult.Status == ValidationResultStatus.Unavailable)
        {
            // Transient server error (e.g. store unavailable). Protocol requirement: accept first, then
            // close with a non-4003 status so SDKs treat it as transient and reconnect.
            using var unavailableWebSocket = await httpContext.WebSockets.AcceptWebSocketAsync();
            logger.LogWarning("Streaming validation unavailable: {Reason}", validationResult.Reason);
            await unavailableWebSocket.CloseOutputAsync(
                WebSocketCloseStatus.InternalServerError,
                "service unavailable, close by server",
                CancellationToken.None
            );
            return;
        }

        // Validation passed; now accept the WebSocket
        using var websocket = await httpContext.WebSockets.AcceptWebSocketAsync();

        var connectionContext = new DefaultConnectionContext(websocket, httpContext);
        await connectionContext.PrepareForProcessingAsync(validationResult.Secrets);

        connectionManager.Add(connectionContext);

        using var cts = CancellationTokenSource.CreateLinkedTokenSource(
            httpContext.RequestAborted,
            applicationLifetime.ApplicationStopping
        );

        // dispatch connection messages
        await dispatcher.DispatchAsync(connectionContext, cts.Token);

        // dispatch end means the connection was closed
        await connectionContext.CloseAsync();

        connectionManager.Remove(connectionContext);
    }
}
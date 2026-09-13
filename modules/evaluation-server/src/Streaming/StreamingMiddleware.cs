using System.Diagnostics;
using System.Net.WebSockets;
using Domain.Observability;
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

        // Read before validation so a rejection can still be attributed to a connection type.
        // Unrecognized values are normalized away inside StreamingMetrics.
        var connectionType = httpContext.Request.Query["type"].ToString();

        // T2. Ends at the handshake, deliberately not at disconnect — see HandshakeTrace.
        using var handshake = HandshakeTrace.Start(connectionType);

        // Validate request PRE-accept (before accepting WebSocket)
        var validationResult = await requestValidator.ValidateAsync(httpContext);
        if (validationResult.Status == ValidationResultStatus.Invalid)
        {
            StreamingMetrics.Current.RecordUpgrade(
                connectionType, Outcomes.Rejected, StreamingReasons.InvalidRequest);
            handshake.Rejected(StreamingReasons.InvalidRequest);

            logger.RequestRejected(httpContext.Request.QueryString.Value, validationResult.Reason);

            // Protocol requirement: accept first, then close with 4003 so SDKs stop reconnecting.
            using var invalidWebSocket = await httpContext.WebSockets.AcceptWebSocketAsync();
            await invalidWebSocket.CloseOutputAsync(
                (WebSocketCloseStatus)4003,
                "invalid request, close by server",
                CancellationToken.None
            );

            return;
        }

        if (validationResult.Status == ValidationResultStatus.Unavailable)
        {
            StreamingMetrics.Current.RecordUpgrade(
                connectionType, Outcomes.Rejected, StreamingReasons.Unavailable);
            handshake.Rejected(StreamingReasons.Unavailable);

            logger.RequestValidationUnavailable(httpContext.Request.QueryString.Value, validationResult.Reason);
            
            // Transient server error (e.g. store unavailable). Protocol requirement: accept first, then
            // close with a non-4003 status so SDKs treat it as transient and reconnect.
            using var unavailableWebSocket = await httpContext.WebSockets.AcceptWebSocketAsync();
            await unavailableWebSocket.CloseOutputAsync(
                WebSocketCloseStatus.InternalServerError,
                "service unavailable, close by server",
                CancellationToken.None
            );

            return;
        }

        // Validation passed; now accept the WebSocket
        using var websocket = await httpContext.WebSockets.AcceptWebSocketAsync();

        StreamingMetrics.Current.RecordUpgrade(
            connectionType, Outcomes.Success, StreamingReasons.Accepted);
        StreamingMetrics.Current.SocketOpened();

        // The handshake is over the moment the socket is accepted; the connection that follows is
        // covered by streaming.connection_duration, not by this span.
        handshake.Accepted();
        handshake.Dispose();

        var startedAt = Stopwatch.GetTimestamp();
        var closeReason = StreamingReasons.ClientClosed;

        try
        {
            var connectionContext = new DefaultConnectionContext(websocket, httpContext);
            await connectionContext.PrepareForProcessingAsync(validationResult.Secrets);

            await connectionManager.Add(connectionContext);

            using var cts = CancellationTokenSource.CreateLinkedTokenSource(
                httpContext.RequestAborted,
                applicationLifetime.ApplicationStopping
            );

            // dispatch connection messages
            await dispatcher.DispatchAsync(connectionContext, cts.Token);

            // A connection ending during shutdown is a rolling restart, not a client disconnect.
            // Conflating the two would make every deployment look like a client-side incident.
            closeReason = applicationLifetime.ApplicationStopping.IsCancellationRequested
                ? StreamingReasons.ServerShutdown
                : httpContext.RequestAborted.IsCancellationRequested
                    ? StreamingReasons.ClientAborted
                    : StreamingReasons.ClientClosed;

            // dispatch end means the connection was closed
            await connectionContext.CloseAsync();

            await connectionManager.Remove(connectionContext);
        }
        catch (Exception)
        {
            closeReason = StreamingReasons.Error;
            throw;
        }
        finally
        {
            // In a finally so an exception on the connection cannot leak the active-socket gauge
            // upwards for the lifetime of the process.
            StreamingMetrics.Current.SocketClosed(
                connectionType, closeReason, Stopwatch.GetElapsedTime(startedAt));
        }
    }
}
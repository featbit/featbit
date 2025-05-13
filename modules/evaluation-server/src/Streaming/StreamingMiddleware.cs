using System.Net.WebSockets;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Streaming.Connections;
using Streaming.Messages;

namespace Streaming;

public class StreamingMiddleware(
    IHostApplicationLifetime applicationLifetime,
    ILogger<StreamingMiddleware> logger,
    RequestDelegate next)
{
    private const string StreamingPath = "/streaming";

    public async Task InvokeAsync(
        HttpContext httpContext,
        IRequestValidator requestValidator,
        MessageDispatcher dispatcher,
        IConnectionManager connectionManager)
    {
        var request = httpContext.Request;

        // if not streaming request
        if (!request.Path.StartsWithSegments(StreamingPath) || !httpContext.WebSockets.IsWebSocketRequest)
        {
            await next.Invoke(httpContext);
            return;
        }

        using var websocket = await httpContext.WebSockets.AcceptWebSocketAsync();

        var connectionContext = new DefaultWebSocketConnectionContext(websocket, httpContext);
        var validationResult = await requestValidator.ValidateAsync(connectionContext);
        if (!validationResult.IsValid)
        {
            logger.RequestRejected(httpContext.Request.QueryString.Value, validationResult.Reason);
            await websocket.CloseOutputAsync(
                (WebSocketCloseStatus)4003,
                "invalid request, close by server",
                CancellationToken.None
            );
            return;
        }

        await connectionContext.PrepareForProcessingAsync(validationResult.Secrets);

        var connection = connectionManager.Add(connectionContext);

        using var cts = CancellationTokenSource.CreateLinkedTokenSource(
            httpContext.RequestAborted,
            applicationLifetime.ApplicationStopping
        );

        // dispatch connection messages
        await dispatcher.DispatchAsync(connection, cts.Token);

        // dispatch end means the connection was closed
        await connection.CloseAsync(
            websocket.CloseStatus ?? WebSocketCloseStatus.NormalClosure,
            websocket.CloseStatusDescription ?? string.Empty
        );

        connectionManager.Remove(connectionContext);
    }
}
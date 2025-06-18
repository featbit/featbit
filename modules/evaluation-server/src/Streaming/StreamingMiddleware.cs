using System.Net.WebSockets;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Internal;
using Microsoft.Extensions.Logging;
using Streaming.Connections;
using Streaming.Shared;

namespace Streaming;

public class StreamingMiddleware
{
    private const string StreamingPath = "/streaming";
    private readonly ISystemClock _systemClock;
    private readonly IHostApplicationLifetime _applicationLifetime;
    private readonly ILogger<StreamingMiddleware> _logger;

    private readonly RequestDelegate _next;

    public StreamingMiddleware(
        ISystemClock systemClock,
        IHostApplicationLifetime applicationLifetime,
        ILogger<StreamingMiddleware> logger,
        RequestDelegate next)
    {
        _systemClock = systemClock;
        _applicationLifetime = applicationLifetime;
        _logger = logger;
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context, IConnectionHandler handler)
    {
        var request = context.Request;

        // if not streaming request
        if (!request.Path.StartsWithSegments(StreamingPath) || !context.WebSockets.IsWebSocketRequest)
        {
            await _next.Invoke(context);
            return;
        }

        // transitions the request to a WebSocket connection
        using var ws = await context.WebSockets.AcceptWebSocketAsync();

        // try accept request
        var query = request.Query;
        var currentTimestamp = _systemClock.UtcNow.ToUnixTimeMilliseconds();

        var (connection, rejectReason) =
            RequestHandler.TryAcceptRequest(ws, query["type"], query["version"], query["token"], currentTimestamp);
        if (connection == null)
        {
            _logger.LogWarning(
                "Streaming request was rejected: {Request}. Reason: {Reason}.",
                context.Request.QueryString.Value,
                rejectReason
            );

            await ws.CloseOutputAsync(
                (WebSocketCloseStatus)4003,
                "invalid request, close by server",
                CancellationToken.None
            );
            return;
        }

        // use ApplicationStopping token
        await handler.OnConnectedAsync(connection, _applicationLifetime.ApplicationStopping);
    }
}
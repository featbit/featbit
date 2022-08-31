using System.Net.WebSockets;
using System.Text;
using Domain.Streaming;

namespace Api.Middlewares;

public class StreamingMiddleware
{
    private const string StreamingPath = "/streaming";
    private readonly RequestDelegate _next;

    public StreamingMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
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
        
        // validate request
        var query = request.Query;
        if (!RequestHandler.TryAcceptRequest(query["type"], query["version"], query["token"]))
        {
            await ws.CloseOutputAsync(
                (WebSocketCloseStatus)4003,
                "invalid request, close by server",
                CancellationToken.None
            );
            return;
        }

        // send message to client
        await ws.SendAsync(
            Encoding.UTF8.GetBytes("hello, client!"),
            WebSocketMessageType.Text,
            true,
            CancellationToken.None
        );

        // close websocket after 1s
        await Task.Delay(1000);
    }
}
using System.Net.WebSockets;
using System.Text;
using Domain.Streaming;
using Version = Domain.Streaming.Version;

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
        if (!TryAcceptRequest(request))
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

    private bool TryAcceptRequest(HttpRequest request)
    {
        var query = request.Query;
        
        // sdkType
        var sdkType = query["type"].ToString();
        if (!SdkTypes.IsRegistered(sdkType))
        {
            return false;
        }
        
        // version
        var version = query["version"].ToString();
        if (!Version.IsSupported(version))
        {
            return false;
        }

        // connection token
        var token = new Token(query["token"].ToString());
        if (!token.IsValid)
        {
            return false;
        }

        return true;
    }
}
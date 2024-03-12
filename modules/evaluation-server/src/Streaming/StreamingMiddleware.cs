using System.Net;
using System.Net.WebSockets;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Internal;
using Streaming.Connections;
using Streaming.Shared;

namespace Streaming;

public class StreamingMiddleware
{
    private const string StreamingPath = "/streaming";
    private readonly ISystemClock _systemClock;
    private readonly IHostApplicationLifetime _applicationLifetime;

    private readonly RequestDelegate _next;

    public StreamingMiddleware(
        ISystemClock systemClock,
        IHostApplicationLifetime applicationLifetime,
        RequestDelegate next)
    {
        _systemClock = systemClock;
        _applicationLifetime = applicationLifetime;
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
        var clientIpAddress = GetClientIpAddress(context);
        var clientHost = await GetClientHostAsync(clientIpAddress);

        var connection =
            RequestHandler.TryAcceptRequest(ws, query["type"], query["version"], query["token"], currentTimestamp, clientIpAddress, clientHost);
        if (connection == null)
        {
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

    private string GetClientIpAddress(HttpContext context)
    {
        if (context.Request.Headers.TryGetValue("X-Forwarded-For", out var forwardForHeaders))
        {
            return forwardForHeaders.FirstOrDefault(string.Empty);
        }
        // cloudflare connecting IP header
        // https://developers.cloudflare.com/fundamentals/reference/http-request-headers/#cf-connecting-ip
        if (context.Request.Headers.TryGetValue("CF-Connecting-IP", out var cfConnectingIpHeaders))
        {
            return cfConnectingIpHeaders.FirstOrDefault(string.Empty);
        }
        
        var remoteIpAddr = context.Connection.RemoteIpAddress?.ToString();
        return remoteIpAddr ?? string.Empty;
    }

    private async Task<string> GetClientHostAsync(string clientIpAddress)
    {
        if (string.IsNullOrEmpty(clientIpAddress))
        {
            return string.Empty;
        }
        
        try
        {
            var cancellationToken = new CancellationTokenSource(TimeSpan.FromSeconds(2)).Token;
            return (await Dns.GetHostEntryAsync(clientIpAddress, cancellationToken)).HostName;
        }
        catch (Exception)
        {
            // allow clientHost to stay empty without failing the connection.
            return string.Empty;
        }
    }
}
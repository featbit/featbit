using System.Net;
using System.Net.WebSockets;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Hosting;
using Streaming.Connections;

namespace Streaming;

public class StreamingMiddleware
{
    private const string StreamingPath = "/streaming";
    private readonly IHostApplicationLifetime _applicationLifetime;
    private readonly RequestDelegate _next;

    public StreamingMiddleware(IHostApplicationLifetime applicationLifetime, RequestDelegate next)
    {
        _applicationLifetime = applicationLifetime;
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context, IRequestValidator requestValidator, IConnectionHandler handler)
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

        var query = context.Request.Query;
        var connection =
            await requestValidator.ValidateAsync(ws, query["type"], query["version"], query["token"]);
        if (connection == null)
        {
            await ws.CloseOutputAsync(
                (WebSocketCloseStatus)4003,
                "invalid request, close by server",
                CancellationToken.None
            );
            return;
        }

        // if the connection is valid (not null), attach the client to the connection
        var client = await GetClientAsync(context);
        connection.AttachClient(client);

        await handler.OnConnectedAsync(connection, _applicationLifetime.ApplicationStopping);
    }

    private static async Task<Client> GetClientAsync(HttpContext context)
    {
        var ipAddr = GetIpAddr();
        var host = await GetHostAsync();

        return new Client(ipAddr, host);

        string GetIpAddr()
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

        async Task<string> GetHostAsync()
        {
            if (string.IsNullOrEmpty(ipAddr))
            {
                return string.Empty;
            }

            try
            {
                var cancellationToken = new CancellationTokenSource(TimeSpan.FromSeconds(2)).Token;
                return (await Dns.GetHostEntryAsync(ipAddr, cancellationToken)).HostName;
            }
            catch (Exception)
            {
                // allow clientHost to stay empty without failing the connection.
                return string.Empty;
            }
        }
    }
}
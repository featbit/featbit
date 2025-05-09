using System.Net;
using System.Net.WebSockets;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Hosting;
using Streaming.Connections;
using Streaming.Messages;

namespace Streaming;

public class StreamingMiddleware(IHostApplicationLifetime applicationLifetime, RequestDelegate next)
{
    private const string StreamingPath = "/streaming";

    public async Task InvokeAsync(
        HttpContext context,
        IRequestValidator requestValidator,
        MessageDispatcher dispatcher,
        IConnectionManager connectionManager)
    {
        var request = context.Request;

        // if not streaming request
        if (!request.Path.StartsWithSegments(StreamingPath) || !context.WebSockets.IsWebSocketRequest)
        {
            await next.Invoke(context);
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

        // add connection
        connectionManager.Add(connection);

        using var cts = CancellationTokenSource.CreateLinkedTokenSource(
            context.RequestAborted,
            applicationLifetime.ApplicationStopping
        );

        // dispatch connection messages
        await dispatcher.DispatchAsync(connection, cts.Token);

        // dispatcher ends means the connection was closed
        await connection.CloseAsync(
            ws.CloseStatus ?? WebSocketCloseStatus.NormalClosure,
            ws.CloseStatusDescription ?? string.Empty,
            DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
        );

        // remove connection
        connectionManager.Remove(connection);
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
                return forwardForHeaders.FirstOrDefault(string.Empty)!;
            }

            // cloudflare connecting IP header
            // https://developers.cloudflare.com/fundamentals/reference/http-request-headers/#cf-connecting-ip
            if (context.Request.Headers.TryGetValue("CF-Connecting-IP", out var cfConnectingIpHeaders))
            {
                return cfConnectingIpHeaders.FirstOrDefault(string.Empty)!;
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
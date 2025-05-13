using System.Net;
using System.Net.WebSockets;
using Domain.Shared;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Streaming.Connections;

internal sealed class DefaultWebSocketConnectionContext : WebsocketConnectionContext
{
    private readonly HttpContext _httpContext;

    public override WebSocket WebSocket { get; }
    public override string Type { get; }
    public override string Version { get; }
    public override string Token { get; }
    public override long ConnectAt { get; }
    public override Client Client { get; protected set; }
    public override Connection Connection { get; protected set; }
    public override Connection[] MappedRpConnections { get; protected set; }

    public DefaultWebSocketConnectionContext(WebSocket websocket, HttpContext httpContext)
    {
        WebSocket = websocket;
        _httpContext = httpContext;

        var query = _httpContext.Request.Query;

        Type = query["type"].ToString();
        Version = query["version"].ToString();
        Token = query["token"].ToString();
        ConnectAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

        Client = Client.Empty;
        Connection = null!;
        MappedRpConnections = [];
    }

    public async Task PrepareForProcessingAsync(Secret[] secrets)
    {
        await ResolveClientAsync();

        if (Type == ConnectionType.RelayProxy)
        {
            // primary connection of relay proxy
            Connection = new Connection(
                Guid.NewGuid().ToString("D"), WebSocket, new Secret(), Type, Version, ConnectAt, Client
            );

            MappedRpConnections = secrets
                .Select(secret => new Connection(this, secret))
                .ToArray();
        }
        else
        {
            var connection = new Connection(this, secrets[0]);
            Connection = connection;
        }

        return;

        async Task ResolveClientAsync()
        {
            var logger = _httpContext.RequestServices.GetRequiredService<ILogger<WebsocketConnectionContext>>();

            var ipAddr = GetIpAddr();
            var host = await GetHostAsync();

            Client = new Client(ipAddr, host);
            return;

            string GetIpAddr()
            {
                if (_httpContext.Request.Headers.TryGetValue("X-Forwarded-For", out var forwardForHeaders))
                {
                    return forwardForHeaders.FirstOrDefault(string.Empty)!;
                }

                // cloudflare connecting IP header
                // https://developers.cloudflare.com/fundamentals/reference/http-request-headers/#cf-connecting-ip
                if (_httpContext.Request.Headers.TryGetValue("CF-Connecting-IP", out var cfConnectingIpHeaders))
                {
                    return cfConnectingIpHeaders.FirstOrDefault(string.Empty)!;
                }

                var remoteIpAddr = _httpContext.Connection.RemoteIpAddress?.ToString();
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
                    using var cancellationTokenSource = new CancellationTokenSource(TimeSpan.FromSeconds(2));
                    return (await Dns.GetHostEntryAsync(ipAddr, cancellationTokenSource.Token)).HostName;
                }
                catch (Exception)
                {
                    logger.FailedToResolveHost(ipAddr);

                    // allow clientHost to stay empty without failing the connection.
                    return string.Empty;
                }
            }
        }
    }
}
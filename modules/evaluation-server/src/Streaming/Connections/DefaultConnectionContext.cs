using System.Net;
using System.Net.WebSockets;
using Domain.Shared;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Streaming.Connections;

internal sealed class DefaultConnectionContext : ConnectionContext
{
    private readonly HttpContext _httpContext;
    private readonly StreamingOptions _streamingOptions;

    public override string? RawQuery { get; }
    public override WebSocket WebSocket { get; }
    public override string Type { get; }
    public override string Version { get; }
    public override string Token { get; }
    public override Client? Client { get; protected set; }
    public override Connection Connection { get; protected set; }
    public override Connection[] MappedRpConnections { get; protected set; }
    public override long ConnectAt { get; }
    public override long ClosedAt { get; protected set; }

    public DefaultConnectionContext(WebSocket websocket, HttpContext httpContext)
    {
        _httpContext = httpContext;

        _streamingOptions = _httpContext.RequestServices.GetRequiredService<StreamingOptions>();
        RawQuery = httpContext.Request.QueryString.Value;
        WebSocket = websocket;

        var query = httpContext.Request.Query;
        Type = query["type"].ToString();
        Version = query["version"].ToString();
        Token = query["token"].ToString();
        ConnectAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

        Client = null;
        Connection = null!;
        MappedRpConnections = [];
    }

    public async Task PrepareForProcessingAsync(Secret[] secrets)
    {
        await ResolveClientAsync();

        if (Type == ConnectionType.RelayProxy)
        {
            MappedRpConnections = secrets
                .Select(secret => new Connection(WebSocket, secret))
                .ToArray();
        }
        else
        {
            Connection = new Connection(WebSocket, secrets[0]);
        }

        return;

        async ValueTask ResolveClientAsync()
        {
            var ipAddr = GetIpAddr();

            var host = _streamingOptions.TrackClientHostName
                ? await GetHostAsync()
                : string.Empty;

            Client = new Client(ipAddr, host);
            return;

            string GetIpAddr()
            {
                // x-forwarded-for header
                // https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Forwarded-For
                if (_httpContext.Request.Headers.TryGetValue("X-Forwarded-For", out var forwardForHeaders))
                {
                    var headerValue = forwardForHeaders.FirstOrDefault(string.Empty);
                    if (!string.IsNullOrEmpty(headerValue))
                    {
                        // X-Forwarded-For can contain multiple IPs (client, proxy1, proxy2...)
                        // The first IP is the original client IP
                        return headerValue.Split(',')[0].Trim();
                    }
                }

                // cloudflare connecting IP header
                // https://developers.cloudflare.com/fundamentals/reference/http-request-headers/#cf-connecting-ip
                if (_httpContext.Request.Headers.TryGetValue("CF-Connecting-IP", out var cfConnectingIpHeaders))
                {
                    var headerValue = cfConnectingIpHeaders.FirstOrDefault(string.Empty);
                    if (!string.IsNullOrEmpty(headerValue))
                    {
                        return headerValue;
                    }
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
                catch (Exception ex)
                {
                    var logger = _httpContext.RequestServices.GetService<ILogger<ConnectionContext>>();
                    logger?.FailedToResolveHost(ipAddr, ex);

                    // allow clientHost to stay empty without failing the connection.
                    return string.Empty;
                }
            }
        }
    }
}
using System.Net.WebSockets;
using Domain.EndUsers;
using Domain.Shared;
using Microsoft.Extensions.Logging;
using Streaming.Protocol;

namespace Streaming.Connections;

public class Connection
{
    public string Id { get; }

    [LogPropertyIgnore]
    public WebSocket WebSocket { get; }

    /// <summary>
    /// client-side sdk EndUser
    /// </summary>
    [LogPropertyIgnore]
    public EndUser? User { get; set; }

    public string Type { get; }

    public string Version { get; }

    public long ConnectAt { get; }

    public long CloseAt { get; private set; }

    #region extra

    public string ProjectKey { get; }

    public Guid EnvId { get; }

    public string EnvKey { get; }

    public string ClientIpAddress { get; private set; }

    public string ClientHost { get; private set; }

    #endregion

    public Connection(WebsocketConnectionContext context, Secret secret)
    {
        Id = Guid.NewGuid().ToString("D");

        WebSocket = context.WebSocket;
        Type = context.Type;
        Version = context.Version;
        ConnectAt = context.ConnectAt;
        CloseAt = 0;

        ProjectKey = secret.ProjectKey;
        EnvId = secret.EnvId;
        EnvKey = secret.EnvKey;

        ClientIpAddress = context.Client.IpAddress;
        ClientHost = context.Client.Host;
    }

    public Connection(
        string id,
        WebSocket webSocket,
        Secret secret,
        string type,
        string version,
        long connectAt,
        Client client)
    {
        Id = id;

        WebSocket = webSocket;
        Type = type;
        Version = version;
        ConnectAt = connectAt;
        CloseAt = 0;

        ProjectKey = secret.ProjectKey;
        EnvId = secret.EnvId;
        EnvKey = secret.EnvKey;

        ClientIpAddress = client.IpAddress;
        ClientHost = client.Host;
    }

    public async Task SendAsync(ReadOnlyMemory<byte> bytes, CancellationToken cancellationToken)
    {
        await WebSocket.SendAsync(bytes, WebSocketMessageType.Text, true, cancellationToken);
    }

    public async Task SendAsync(ServerMessage message, CancellationToken cancellationToken)
    {
        await WebSocket.SendAsync(message.GetBytes(), WebSocketMessageType.Text, true, cancellationToken);
    }

    public async Task CloseAsync(WebSocketCloseStatus status, string description)
    {
        if (WebSocket.State is WebSocketState.Open or WebSocketState.CloseReceived)
        {
            await WebSocket.CloseOutputAsync(status, description, CancellationToken.None);
        }

        MarkAsClosed();
    }

    public void MarkAsClosed()
    {
        CloseAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
    }

    /// <summary>
    /// attach client-side sdk EndUser
    /// </summary>
    public void AttachUser(EndUser user)
    {
        User = user;
    }
}
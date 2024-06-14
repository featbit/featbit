using System.Diagnostics.CodeAnalysis;
using System.Net.WebSockets;
using Domain.EndUsers;
using Domain.Shared;
using Streaming.Messages;
using Streaming.Protocol;

namespace Streaming.Connections;

public class Connection
{
    public string Id { get; }

    public WebSocket WebSocket { get; }

    /// <summary>
    /// client-side sdk EndUser
    /// </summary>
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

    public Connection(
        string id,
        WebSocket webSocket,
        Secret secret,
        string type,
        string version,
        long connectAt)
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
    }

    public async Task SendAsync(Message message, CancellationToken cancellationToken)
    {
        await WebSocket.SendAsync(message.Bytes, message.Type, true, cancellationToken);
    }

    public async Task SendAsync(ServerMessage message, CancellationToken cancellationToken)
    {
        await WebSocket.SendAsync(message.GetBytes(), WebSocketMessageType.Text, true, cancellationToken);
    }

    public async Task CloseAsync(WebSocketCloseStatus status, string description, long closeAt)
    {
        if (WebSocket.State is WebSocketState.Open or WebSocketState.CloseReceived)
        {
            await WebSocket.CloseOutputAsync(status, description, CancellationToken.None);
        }

        CloseAt = closeAt;
    }

    public void AttachClient(Client client)
    {
        ClientIpAddress = client.IpAddress;
        ClientHost = client.Host;
    }

    /// <summary>
    /// attach client-side sdk EndUser
    /// </summary>
    public void AttachUser(EndUser user)
    {
        User = user;
    }
}
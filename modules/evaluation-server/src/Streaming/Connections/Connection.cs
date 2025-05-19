using System.Net.WebSockets;
using Domain.EndUsers;
using Domain.Shared;
using Streaming.Protocol;

namespace Streaming.Connections;

public class Connection
{
    public string Id { get; }

    public WebSocket WebSocket { get; }

    public Secret Secret { get; }

    /// <summary>
    /// client-side sdk EndUser
    /// </summary>
    public EndUser? User { get; set; }

    public string Type => Secret.Type;
    public Guid EnvId => Secret.EnvId;
    public string ProjectKey => Secret.ProjectKey;
    public string EnvKey => Secret.EnvKey;

    public Connection(WebSocket webSocket, Secret secret)
    {
        Id = Guid.NewGuid().ToString("D");
        WebSocket = webSocket;
        Secret = secret;
    }

    public async Task SendAsync(ServerMessage message, CancellationToken cancellationToken)
        => await WebSocket.SendAsync(message.GetBytes(), WebSocketMessageType.Text, true, cancellationToken);

    /// <summary>
    /// attach client-side sdk EndUser
    /// </summary>
    public void AttachUser(EndUser user)
    {
        User = user;
    }
}
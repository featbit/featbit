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

    public override string ToString()
    {
        // do not use Enum.ToString() here to avoid memory allocation
        var status = WebSocket.State switch
        {
            WebSocketState.None => nameof(WebSocketState.None),
            WebSocketState.Connecting => nameof(WebSocketState.Connecting),
            WebSocketState.Open => nameof(WebSocketState.Open),
            WebSocketState.CloseSent => nameof(WebSocketState.CloseSent),
            WebSocketState.CloseReceived => nameof(WebSocketState.CloseReceived),
            WebSocketState.Closed => nameof(WebSocketState.Closed),
            WebSocketState.Aborted => nameof(WebSocketState.Aborted),
            _ => throw new ArgumentOutOfRangeException()
        };

        return
            $"id={Id},type={Type},projectEnv={ProjectKey}:{EnvKey},user={User?.KeyId ?? string.Empty},status={status}";
    }
}
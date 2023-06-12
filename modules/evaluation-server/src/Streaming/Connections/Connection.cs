using System.Diagnostics.CodeAnalysis;
using System.Net.WebSockets;
using Domain.EndUsers;
using Streaming.Messages;
using Streaming.Protocol;

namespace Streaming.Connections;

public class Connection
{
    public string Id { get; }

    public WebSocket WebSocket { get; }

    public Guid EnvId { get; }

    /// <summary>
    /// client-side sdk EndUser
    /// </summary>
    public EndUser? User { get; set; }

    public string Type { get; }

    public string Version { get; }

    public long ConnectAt { get; }

    public long CloseAt { get; private set; }

    public Connection(
        WebSocket webSocket,
        Guid envId,
        string type,
        string version,
        long? connectAt = null,
        long? closeAt = null)
    {
        Id = Guid.NewGuid().ToString("D");

        WebSocket = webSocket;
        EnvId = envId;
        Type = type;
        Version = version;
        ConnectAt = connectAt ?? DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        CloseAt = closeAt ?? 0;
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

    /// <summary>
    /// attach client-side sdk EndUser
    /// </summary>
    public void AttachUser(EndUser user)
    {
        User = user;
    }

    [ExcludeFromCodeCoverage]
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

        // In C# 10 and .NET 6 string interpolation is very performant
        // check this: https://devblogs.microsoft.com/dotnet/string-interpolation-in-c-10-and-net-6/
        return
            $"id={Id},envId={EnvId},sdkType={Type},version={Version},status={status},connectAt={ConnectAt},closeAt={CloseAt}";
    }
}
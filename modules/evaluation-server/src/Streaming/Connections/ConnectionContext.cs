using System.Net.WebSockets;
using Streaming.Protocol;

namespace Streaming.Connections;

public abstract class ConnectionContext
{
    public abstract string? RawQuery { get; }

    public abstract WebSocket WebSocket { get; }

    public abstract string Type { get; }

    public abstract string Version { get; }

    public abstract string Token { get; }

    public abstract Client? Client { get; protected set; }

    public abstract Connection Connection { get; protected set; }

    public abstract Connection[] MappedRpConnections { get; protected set; }

    public abstract long ConnectAt { get; }

    public abstract long ClosedAt { get; protected set; }

    public async Task CloseAsync()
    {
        var status = WebSocket.CloseStatus ?? WebSocketCloseStatus.NormalClosure;
        var description = WebSocket.CloseStatusDescription ?? string.Empty;

        if (WebSocket.State is WebSocketState.Open or WebSocketState.CloseReceived)
        {
            await WebSocket.CloseOutputAsync(status, description, CancellationToken.None);
        }

        MarkAsClosed();
    }

    public void MarkAsClosed() => ClosedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

    public async Task SendAsync(ReadOnlyMemory<byte> bytes, CancellationToken cancellationToken)
        => await WebSocket.SendAsync(bytes, WebSocketMessageType.Text, true, cancellationToken);

    public async Task SendAsync(ServerMessage message, CancellationToken cancellationToken)
        => await WebSocket.SendAsync(message.GetBytes(), WebSocketMessageType.Text, true, cancellationToken);

    public void Deconstruct(
        out WebSocket websocket,
        out string type,
        out string version,
        out string token)
    {
        websocket = WebSocket;
        type = Type;
        version = Version;
        token = Token;
    }
}
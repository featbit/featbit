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
        await WebSocketSender.For(WebSocket).CompleteAsync();
        var status = WebSocket.CloseStatus ?? WebSocketCloseStatus.NormalClosure;
        var description = WebSocket.CloseStatusDescription ?? string.Empty;

        if (WebSocket.State is WebSocketState.Open or WebSocketState.CloseReceived)
        {
            using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(10));
            try
            {
                await WebSocket.CloseOutputAsync(status, description, timeout.Token).WaitAsync(timeout.Token);
            }
            catch
            {
                WebSocket.Abort();
                throw;
            }
        }

        MarkAsClosed();
    }

    public void MarkAsClosed()
    {
        WebSocketSender.For(WebSocket).Stop();
        ClosedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
    }

    public Task SendAsync(ReadOnlyMemory<byte> bytes, CancellationToken cancellationToken)
        => WebSocketSender.For(WebSocket).SendAsync(bytes, cancellationToken);

    public Task SendAsync(ServerMessage message, CancellationToken cancellationToken)
        => SendAsync(message.GetBytes(), cancellationToken);

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

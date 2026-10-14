using System.Net.WebSockets;
using Domain.Observability;
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

    /// <summary>
    /// Sends a pre-serialized frame. Used where the payload is a compile-time constant, so there is
    /// no <see cref="ServerMessage"/> to read a message type from — the caller supplies it instead.
    /// </summary>
    /// <param name="bytes">The frame to write, already serialized.</param>
    /// <param name="operation">
    /// The message type to tag the size with. Defaults to <see cref="StreamingReasons.Unknown"/>
    /// rather than being required, so an un-updated caller shows up as <c>unknown</c> instead of
    /// silently disappearing from <c>streaming.sent_message_size</c> — which is how this overload
    /// went unmeasured in the first place. Values must come from <see cref="MessageTypes"/>; this
    /// tag feeds a metric attribute and must stay a closed set.
    /// </param>
    /// <param name="cancellationToken">Cancels the send.</param>
    public async Task SendAsync(
        ReadOnlyMemory<byte> bytes,
        string operation,
        CancellationToken cancellationToken)
    {
        StreamingMetrics.Current.RecordSentMessage(operation, bytes.Length);

        await WebSocket.SendAsync(bytes, WebSocketMessageType.Text, true, cancellationToken);
    }

    public async Task SendAsync(ReadOnlyMemory<byte> bytes, CancellationToken cancellationToken)
        => await SendAsync(bytes, StreamingReasons.Unknown, cancellationToken);

    public async Task SendAsync(ServerMessage message, CancellationToken cancellationToken)
    {
        // Serialize once and measure the same buffer the socket writes, so the size is exact and
        // instrumentation adds no work beyond a length read.
        var bytes = message.GetBytes();
        StreamingMetrics.Current.RecordSentMessage(message.MessageType, bytes.Length);

        await WebSocket.SendAsync(bytes, WebSocketMessageType.Text, true, cancellationToken);
    }

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
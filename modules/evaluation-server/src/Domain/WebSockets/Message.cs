using System.Net.WebSockets;

namespace Domain.WebSockets;

public class Message
{
    public static readonly Message EmptyText = new(ReadOnlyMemory<byte>.Empty, WebSocketMessageType.Text);

    public static readonly Message EmptyBinary = new(ReadOnlyMemory<byte>.Empty, WebSocketMessageType.Binary);

    public static readonly Message Close = new(ReadOnlyMemory<byte>.Empty, WebSocketMessageType.Close);

    public readonly ReadOnlyMemory<byte> Bytes;

    public readonly WebSocketMessageType Type;

    public Message(ReadOnlyMemory<byte> bytes, WebSocketMessageType type)
    {
        Bytes = bytes;
        Type = type;
    }

    public static Message Empty(WebSocketMessageType type)
    {
        return type switch
        {
            WebSocketMessageType.Binary => EmptyBinary,
            WebSocketMessageType.Text => EmptyText,
            _ => throw new InvalidOperationException("invalid message type")
        };
    }
}
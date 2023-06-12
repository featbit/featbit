using System.Net.WebSockets;
using System.Text;

namespace Streaming.Messages;

public class Message
{
    public static readonly Message EmptyText = new(ReadOnlyMemory<byte>.Empty, WebSocketMessageType.Text);

    public static readonly Message EmptyBinary = new(ReadOnlyMemory<byte>.Empty, WebSocketMessageType.Binary);

    public static readonly Message Close = new(ReadOnlyMemory<byte>.Empty, WebSocketMessageType.Close);

    public static readonly Message Pong = new(
        Encoding.UTF8.GetBytes("{\"messageType\":\"pong\",\"data\":{}}"),
        WebSocketMessageType.Text
    );

    public ReadOnlyMemory<byte> Bytes;

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
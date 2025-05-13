using System.Net.WebSockets;

namespace Streaming.Connections;

public abstract class WebsocketConnectionContext
{
    public abstract string? RawQuery { get; }

    public abstract WebSocket WebSocket { get; }

    public abstract string Type { get; }

    public abstract string Version { get; }

    public abstract string Token { get; }

    public abstract long ConnectAt { get; }

    public abstract Client Client { get; protected set; }

    public abstract Connection Connection { get; protected set; }

    public abstract Connection[] MappedRpConnections { get; protected set; }

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
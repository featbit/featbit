using System.Net.WebSockets;

namespace Streaming.Connections;

public interface IRequestValidator
{
    Task<Connection?> ValidateAsync(
        WebSocket ws,
        string type,
        string version,
        string tokenString
    );
}
using System.Net.WebSockets;

namespace Domain.WebSockets;

public class Connection
{
    public string Id { get; }

    public WebSocket WebSocket { get; }

    public int EnvId { get; }

    public string Type { get; }

    public string Version { get; }

    public long ConnectedAt { get; }

    public Connection(WebSocket webSocket, int envId, string type, string version, long connectedAt)
    {
        Id = Guid.NewGuid().ToString("D");

        WebSocket = webSocket;
        EnvId = envId;
        Type = type;
        Version = version;
        ConnectedAt = connectedAt;
    }
}
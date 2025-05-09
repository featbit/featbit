using System.Net.WebSockets;
using Domain.Shared;
using Streaming.Connections;

namespace Streaming.UnitTests.Connections;

public class ConnectionBuilder
{
    private string _id = Guid.NewGuid().ToString("D");
    private WebSocket _websocket = null!;
    private Secret _secret = TestData.ClientSecret;
    private Client _client = new("127.0.0.1", "localhost");
    private string _type = ConnectionType.Client;
    private string _version = ConnectionVersion.V2;
    private long _connectAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

    public Connection Build()
    {
        var connection = new Connection(_id, _websocket, _secret, _type, _version, _connectAt);
        connection.AttachClient(_client);
        return connection;
    }

    public ConnectionBuilder WithId(string id)
    {
        _id = id;
        return this;
    }

    public ConnectionBuilder WithWebSocket(WebSocket webSocket)
    {
        _websocket = webSocket;
        return this;
    }

    public ConnectionBuilder WithSecret(Secret secret)
    {
        _secret = secret;
        return this;
    }

    public ConnectionBuilder WithClient(Client client)
    {
        _client = client;
        return this;
    }

    public ConnectionBuilder WithType(string type)
    {
        _type = type;
        return this;
    }

    public ConnectionBuilder WithVersion(string version)
    {
        _version = version;
        return this;
    }

    public ConnectionBuilder WithConnectAt(long connectAt)
    {
        _connectAt = connectAt;
        return this;
    }
}
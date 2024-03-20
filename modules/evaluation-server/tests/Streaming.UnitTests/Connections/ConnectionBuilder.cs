using System.Net.WebSockets;
using Domain.Shared;
using Moq;
using Streaming.Connections;

namespace Streaming.UnitTests.Connections;

public class ConnectionBuilder
{
    private string _id;
    private WebSocket _websocket;
    private Secret _secret;
    private Client _client;
    private string _type;
    private string _version;
    private long _connectAt;

    public ConnectionBuilder()
    {
        _id = Guid.NewGuid().ToString("D");

        var websocketMock = new Mock<WebSocket>();
        websocketMock.Setup(x => x.State).Returns(WebSocketState.Open);
        _websocket = websocketMock.Object;

        _secret = TestData.ClientSecret;
        _client = new Client("127.0.0.1", "localhost");
        _type = ConnectionType.Client;
        _version = ConnectionVersion.V2;
        _connectAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
    }

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
using System.Net.WebSockets;
using Domain.Shared;
using Moq;
using Streaming.Connections;

namespace Streaming.UnitTests.Connections;

public class ConnectionContextBuilder
{
    private string _rawQuery =
        $"?type={ConnectionType.Client}&version={ConnectionVersion.V2}&token={TestData.ClientTokenString}";

    private WebSocket _websocket = Mock.Of<WebSocket>(x => x.State == WebSocketState.Open);
    private string _type = ConnectionType.Client;
    private string _version = ConnectionVersion.V2;
    private string _token = TestData.ClientTokenString;
    private Client _client = new("127.0.0.1", "localhost");
    private long _connectAt = 12345678;
    private long _closedAt;

    private Secret _secret = TestData.ClientSecret;
    private Secret[] _secrets = [];

    public ConnectionContext Build()
    {
        var connection = new Connection(_websocket, _secret);

        var mappedConnections = _secrets
            .Select(secret => new Connection(_websocket, secret))
            .ToArray();

        var context = Mock.Of<ConnectionContext>(x =>
            x.RawQuery == _rawQuery &&
            x.WebSocket == _websocket &&
            x.Type == _type &&
            x.Version == _version &&
            x.Token == _token &&
            x.Client == _client &&
            x.Connection == connection &&
            x.MappedRpConnections == mappedConnections &&
            x.ConnectAt == _connectAt &&
            x.ClosedAt == _closedAt
        );

        return context;
    }

    public ConnectionContextBuilder WithRawQuery(string rawQuery)
    {
        _rawQuery = rawQuery;
        return this;
    }

    public ConnectionContextBuilder WithWebSocket(WebSocket webSocket)
    {
        _websocket = webSocket;
        return this;
    }

    public ConnectionContextBuilder WithSecret(Secret secret)
    {
        _secret = secret;
        return this;
    }

    public ConnectionContextBuilder WithType(string type)
    {
        _type = type;
        return this;
    }

    public ConnectionContextBuilder WithVersion(string version)
    {
        _version = version;
        return this;
    }

    public ConnectionContextBuilder WithToken(string token)
    {
        _token = token;
        return this;
    }

    public ConnectionContextBuilder WithClient(Client client)
    {
        _client = client;
        return this;
    }

    public ConnectionContextBuilder WithConnectAt(long connectAt)
    {
        _connectAt = connectAt;
        return this;
    }

    public ConnectionContextBuilder WithClosedAt(long closedAt)
    {
        _closedAt = closedAt;
        return this;
    }

    public ConnectionContextBuilder WithSecrets(Secret[] secrets)
    {
        _secrets = secrets;
        return this;
    }
}
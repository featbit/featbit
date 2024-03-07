using System.Net.WebSockets;
using Moq;
using Streaming.Connections;

namespace Streaming.UnitTests.Connections;

public class ConnectionBuilder
{
    private Mock<WebSocket> _wsMock = new();
    private string _ip = "10.0.0.7";
    private string _host = "test.client.host";
    private string _connectionType = ConnectionType.Server;
    private Guid _envId = TestData.DevEnvId;
    private long _connectAt = DateTime.UtcNow.Ticks;
    private string _version = "1.0";

    public ConnectionBuilder WithClientIp(string ip)
    {
        _ip = ip;
        return this;
    }

    public ConnectionBuilder WithClientHost(string host)
    {
        _host = host;
        return this;
    }

    public ConnectionBuilder WithEnvId(Guid envId)
    {
        _envId = envId;
        return this;
    }

    public ConnectionBuilder WithMockWebSocket(Mock<WebSocket> ws)
    {
        _wsMock = ws;
        return this;
    }

    public ConnectionBuilder WithConnectionType(string connectionType)
    {
        if (!ConnectionType.IsRegistered(connectionType))
        {
            throw new Exception("Invalid ConnectionType.");
        }

        _connectionType = connectionType;
        return this;
    }

    public ConnectionBuilder WithConnectAt(long connectAt)
    {
        this._connectAt = connectAt;
        return this;
    }
    
    public ConnectionBuilder WithVersion(string version)
    {
        _version = version;
        return this;
    }

    public Connection Build()
    {
        return new Connection(
            _wsMock.Object, 
            _envId, 
            _connectionType, 
            _version,
            _connectAt,
            null, 
            _ip, 
            _host);
    }
}
using System.Net.WebSockets;
using Streaming.Connections;
using Microsoft.Extensions.Logging;
using Moq;
using TestBase;

namespace Streaming.UnitTests.Connections;

public class ConnectionManagerTests
{
    private readonly InMemoryFakeLogger<ConnectionManager> _logger = new();
    private readonly Mock<WebSocket> _webSocketMock = new();

    [Fact]
    public void AddAndRemove()
    {
        var manager = new ConnectionManager(_logger);

        _webSocketMock.Setup(x => x.State).Returns(WebSocketState.Open);
        var connection =
            new Connection(_webSocketMock.Object, Guid.NewGuid(), ConnectionType.Server, ConnectionVersion.V2);

        // add connection
        manager.Add(connection);
        Assert.Equal(LogLevel.Trace, _logger.Level);
        Assert.Null(_logger.Ex);
        Assert.Equal($"{connection.Id}: connection added. Details: {connection}", _logger.Message);

        // remove connection
        manager.Remove(connection);
        Assert.Equal(LogLevel.Trace, _logger.Level);
        Assert.Null(_logger.Ex);
        Assert.Equal($"{connection.Id}: connection removed.", _logger.Message);
    }
}
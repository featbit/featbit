using System.Net.WebSockets;
using Domain.WebSockets;
using Microsoft.Extensions.Logging;
using Moq;
using TestBase;

namespace Domain.UnitTests.WebSockets;

public class ConnectionManagerTests
{
    private readonly InMemoryFakeLogger<ConnectionManager> _logger = new();
    private readonly Mock<WebSocket> _webSocketMock = new();

    [Fact]
    public async Task Register_And_Remove()
    {
        var manager = new ConnectionManager(_logger);

        _webSocketMock.Setup(x => x.State).Returns(WebSocketState.Open);
        var connection =
            new Connection(_webSocketMock.Object, 1, ConnectionType.Server, ConnectionVersion.V2, 1662395291241);
        
        // registration
        manager.Register(connection);
        Assert.Equal(LogLevel.Trace, _logger.Level);
        Assert.Null(_logger.Ex);
        Assert.Equal($"{connection.Id}: connection registered. Details: {connection}", _logger.Message);

        // removal
        await manager.RemoveAsync(connection, WebSocketCloseStatus.NormalClosure, "");
        Assert.Equal(LogLevel.Trace, _logger.Level);
        Assert.Null(_logger.Ex);
        Assert.Equal($"{connection.Id}: connection removed", _logger.Message);

        _webSocketMock.Verify(
            x => x.CloseOutputAsync(WebSocketCloseStatus.NormalClosure, "", CancellationToken.None),
            Times.Once
        );
    }
}
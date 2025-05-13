using System.Net.WebSockets;
using Streaming.Connections;
using Moq;

namespace Streaming.UnitTests.Connections;

public class ConnectionTests
{
    private readonly Mock<WebSocket> _webSocketMock = new();
    private readonly Connection _connection;

    public ConnectionTests()
    {
        _connection = new ConnectionBuilder()
            .WithWebSocket(_webSocketMock.Object)
            .Build();
    }

    [Fact]
    public async Task CloseConnection()
    {
        _webSocketMock.Setup(x => x.State).Returns(WebSocketState.Open);

        await _connection.CloseAsync(WebSocketCloseStatus.NormalClosure, string.Empty);

        _webSocketMock.Verify(
            ws => ws.CloseOutputAsync(WebSocketCloseStatus.NormalClosure, string.Empty, CancellationToken.None),
            Times.Once
        );

        Assert.NotEqual(0, _connection.CloseAt);
    }
}
using System.Net.WebSockets;
using Streaming.Connections;
using Moq;

namespace Streaming.UnitTests.Connections;

public class ConnectionTests
{
    private readonly Mock<WebSocket> _webSocketMock = new();
    private readonly Connection _connection;
    private readonly Guid _envId = new("33055a8d-4ec6-4bb9-9edb-43524c4bbd5e");

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

        await _connection.CloseAsync(WebSocketCloseStatus.NormalClosure, string.Empty, 1662904887947);

        _webSocketMock.Verify(
            ws => ws.CloseOutputAsync(WebSocketCloseStatus.NormalClosure, string.Empty, CancellationToken.None),
            Times.Once
        );

        Assert.Equal(1662904887947, _connection.CloseAt);
    }
}
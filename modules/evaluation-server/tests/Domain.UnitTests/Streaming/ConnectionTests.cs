using System.Net.WebSockets;
using Domain.Streaming;
using Moq;
using Version = Domain.Streaming.Version;

namespace Domain.UnitTests.Streaming;

public class ConnectionTests
{
    [Fact]
    public void Should_Create_New_Connection()
    {
        var openedWebsocketMock = new Mock<WebSocket>();
        openedWebsocketMock.Setup(x => x.State).Returns(WebSocketState.Open);

        var connection = new Connection(openedWebsocketMock.Object, 1, ConnectionType.Client, Version.V1, 1662395291241);
        
        Assert.True(Guid.TryParse(connection.Id, out _));
        Assert.Equal(WebSocketState.Open, connection.WebSocket.State);
        Assert.Equal(1, connection.EnvId);
        Assert.Equal(ConnectionType.Client, connection.Type);
        Assert.Equal(Version.V1, connection.Version);
        Assert.Equal(1662395291241, connection.ConnectedAt);
    }
}
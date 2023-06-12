using System.Net.WebSockets;
using Streaming.Connections;
using Moq;

namespace Streaming.UnitTests.Connections;

public class ConnectionStoreTests
{
    private readonly Mock<WebSocket> _webSocketMock = new();

    [Fact]
    public void AddConnection()
    {
        var store = new ConnectionStore();
        var connection =
            new Connection(_webSocketMock.Object, Guid.NewGuid(), ConnectionType.Client, ConnectionVersion.V1);

        Assert.Null(store[connection.Id]);

        store.Add(connection);

        Assert.NotNull(store[connection.Id]);
    }

    [Fact]
    public void RemoveConnection()
    {
        var store = new ConnectionStore();
        var connection =
            new Connection(_webSocketMock.Object, Guid.NewGuid(), ConnectionType.Client, ConnectionVersion.V1);
        store.Add(connection);

        Assert.NotNull(store[connection.Id]);

        store.Remove(connection);

        Assert.Null(store[connection.Id]);
    }
}
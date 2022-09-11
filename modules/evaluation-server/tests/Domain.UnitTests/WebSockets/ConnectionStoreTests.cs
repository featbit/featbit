using System.Net.WebSockets;
using Domain.WebSockets;
using Moq;
using Version = Domain.WebSockets.Version;

namespace Domain.UnitTests.WebSockets;

public class ConnectionStoreTests
{
    private readonly Mock<WebSocket> _webSocketMock = new();

    [Fact]
    public void Should_Add_Connection()
    {
        var store = new ConnectionStore();
        var connection = 
            new Connection(_webSocketMock.Object, 1, ConnectionType.Client, Version.V1, 1661907157706);
        
        Assert.Null(store[connection.Id]);
        
        store.Add(connection);

        Assert.NotNull(store[connection.Id]);
    }

    [Fact]
    public void Should_Remove_Connection()
    {
        var store = new ConnectionStore();
        var connection = 
            new Connection(_webSocketMock.Object, 1, ConnectionType.Client, Version.V1, 1661907157706);
        store.Add(connection);
        
        Assert.NotNull(store[connection.Id]);
        
        store.Remove(connection);
        
        Assert.Null(store[connection.Id]);
    }
}
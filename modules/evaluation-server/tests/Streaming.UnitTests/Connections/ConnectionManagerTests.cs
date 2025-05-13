using Domain.Shared;
using Microsoft.Extensions.Logging.Testing;
using Moq;
using Streaming.Connections;

namespace Streaming.UnitTests.Connections;

public class ConnectionManagerTests
{
    [Fact]
    public void Empty()
    {
        var logger = new FakeLogger<ConnectionManager>();
        var manager = new ConnectionManager(logger);

        Assert.Empty(manager.Connections);
    }

    [Fact]
    public void ClientConnection()
    {
        var logger = new FakeLogger<ConnectionManager>();
        var manager = new ConnectionManager(logger);

        var connection = new ConnectionBuilder().Build();
        var contextMock = new Mock<WebsocketConnectionContext>();
        contextMock
            .Setup(x => x.Type)
            .Returns(connection.Type);
        contextMock
            .Setup(x => x.Connection)
            .Returns(connection);

        manager.Add(contextMock.Object);

        Assert.Single(manager.Connections);
        Assert.NotNull(manager.Connections[connection.Id]);

        manager.Remove(contextMock.Object);
        Assert.Empty(manager.Connections);
    }

    [Fact]
    public void RelayProxyConnections()
    {
        var logger = new FakeLogger<ConnectionManager>();
        var manager = new ConnectionManager(logger);

        var primaryConnection = new ConnectionBuilder().Build();
        var contextMock = new Mock<WebsocketConnectionContext>();
        contextMock
            .Setup(x => x.Type)
            .Returns(ConnectionType.RelayProxy);
        contextMock
            .Setup(x => x.Connection)
            .Returns(primaryConnection);

        Connection[] mappedConnections =
        [
            new ConnectionBuilder().Build(),
            new ConnectionBuilder().Build()
        ];

        contextMock
            .Setup(x => x.MappedRpConnections)
            .Returns(mappedConnections);

        manager.Add(contextMock.Object);

        // make sure the primary connection is not added
        Assert.False(manager.Connections.TryGetValue(primaryConnection.Id, out _));

        // make sure all mapped connections are added
        foreach (var mappedConnection in mappedConnections)
        {
            Assert.NotNull(manager.Connections[mappedConnection.Id]);
        }

        Assert.Equal(2, manager.Connections.Count);

        manager.Remove(contextMock.Object);
        Assert.Empty(manager.Connections);
    }

    [Fact]
    public void GetEnvConnections()
    {
        var logger = new FakeLogger<ConnectionManager>();
        var manager = new ConnectionManager(logger);

        var s1 = new Secret("client", "p1", envId: Guid.NewGuid(), "dev");
        var s2 = new Secret("client", "p2", envId: Guid.NewGuid(), "dev");

        var connection1 = new ConnectionBuilder().WithSecret(s1).Build();
        var contextMock1 = new Mock<WebsocketConnectionContext>();
        contextMock1
            .Setup(x => x.Type)
            .Returns(connection1.Type);
        contextMock1
            .Setup(x => x.Connection)
            .Returns(connection1);

        var connection2 = new ConnectionBuilder().WithSecret(s2).Build();
        var contextMock2 = new Mock<WebsocketConnectionContext>();
        contextMock2
            .Setup(x => x.Type)
            .Returns(connection2.Type);
        contextMock2
            .Setup(x => x.Connection)
            .Returns(connection2);

        manager.Add(contextMock1.Object);
        manager.Add(contextMock2.Object);

        Assert.Equal(2, manager.Connections.Count);

        var e1 = manager.GetEnvConnections(connection1.EnvId);
        Assert.Single(e1);
        Assert.Equal(connection1.Id, e1.First().Id);

        var e2 = manager.GetEnvConnections(connection2.EnvId);
        Assert.Single(e2);
        Assert.Equal(connection2.Id, e2.First().Id);
    }
}
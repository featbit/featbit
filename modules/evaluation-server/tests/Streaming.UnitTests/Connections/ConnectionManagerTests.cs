using Domain.Shared;
using Microsoft.Extensions.Logging.Testing;
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

        var context = new ConnectionContextBuilder().Build();

        manager.Add(context);

        Assert.Single(manager.Connections);
        Assert.NotNull(manager.Connections[context.Connection.Id]);

        manager.Remove(context);
        Assert.Empty(manager.Connections);
    }

    [Fact]
    public void RelayProxyConnections()
    {
        var logger = new FakeLogger<ConnectionManager>();
        var manager = new ConnectionManager(logger);

        Secret[] secrets =
        [
            new(ConnectionType.Client, "p1", Guid.NewGuid(), "dev"),
            new(ConnectionType.Server, "p1", Guid.NewGuid(), "prod"),
        ];

        var context = new ConnectionContextBuilder()
            .WithType(ConnectionType.RelayProxy)
            .WithSecrets(secrets)
            .Build();

        manager.Add(context);

        // make sure all mapped connections are added
        foreach (var mappedRpConnection in context.MappedRpConnections)
        {
            Assert.NotNull(manager.Connections[mappedRpConnection.Id]);
        }

        Assert.Equal(2, manager.Connections.Count);

        manager.Remove(context);
        Assert.Empty(manager.Connections);
    }

    [Fact]
    public void GetEnvConnections()
    {
        var logger = new FakeLogger<ConnectionManager>();
        var manager = new ConnectionManager(logger);

        var s1 = new Secret("client", "p1", envId: Guid.NewGuid(), "dev");
        var s2 = new Secret("client", "p2", envId: Guid.NewGuid(), "dev");

        var c1 = new ConnectionContextBuilder()
            .WithSecret(s1)
            .Build();
        var c2 = new ConnectionContextBuilder()
            .WithSecret(s2)
            .Build();

        manager.Add(c1);
        manager.Add(c2);

        Assert.Equal(2, manager.Connections.Count);

        var e1 = manager.GetEnvConnections(s1.EnvId);
        Assert.Single(e1);
        Assert.Equal(c1.Connection.Id, e1.First().Id);

        var e2 = manager.GetEnvConnections(s2.EnvId);
        Assert.Single(e2);
        Assert.Equal(c2.Connection.Id, e2.First().Id);
    }
}
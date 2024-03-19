using Streaming.Connections;

namespace Streaming.UnitTests.Connections;

public class ConnectionStoreTests
{
    private readonly Connection _connection = new ConnectionBuilder().Build();

    [Fact]
    public void AddConnection()
    {
        var store = new ConnectionStore();

        Assert.Null(store[_connection.Id]);

        store.Add(_connection);

        Assert.NotNull(store[_connection.Id]);
    }

    [Fact]
    public void RemoveConnection()
    {
        var store = new ConnectionStore();

        store.Add(_connection);

        Assert.NotNull(store[_connection.Id]);

        store.Remove(_connection);

        Assert.Null(store[_connection.Id]);
    }
}
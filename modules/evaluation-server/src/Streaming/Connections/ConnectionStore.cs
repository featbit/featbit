using System.Collections.Concurrent;

namespace Streaming.Connections;

public class ConnectionStore
{
    private readonly ConcurrentDictionary<string, Connection> _connections = new(StringComparer.Ordinal);

    /// <summary>
    /// Get the <see cref="Connection"/> by connection Id.
    /// </summary>
    /// <param name="connectionId">The Id of the connection.</param>
    /// <returns>The connection for the <paramref name="connectionId"/>, null if there is no connection.</returns>
    public Connection? this[string connectionId]
    {
        get
        {
            _connections.TryGetValue(connectionId, out var connection);
            return connection;
        }
    }

    /// <summary>
    /// Add a <see cref="Connection"/> to the store.
    /// </summary>
    /// <param name="connection">The connection to add.</param>
    public void Add(Connection connection)
    {
        _connections.TryAdd(connection.Id, connection);
    }

    /// <summary>
    /// Removes a <see cref="Connection"/> from the store.
    /// </summary>
    /// <param name="connection">The connection to remove.</param>
    public void Remove(Connection connection)
    {
        _connections.TryRemove(connection.Id, out _);
    }

    /// <summary>
    /// Find connections by predication
    /// </summary>
    /// <param name="predicate"></param>
    /// <returns></returns>
    public ICollection<Connection> Find(Func<Connection, bool> predicate)
    {
        var connections = new List<Connection>();

        // the enumerator returned from the concurrent dictionary is safe to use concurrently with reads and writes to the dictionary
        // see https://learn.microsoft.com/en-us/dotnet/api/system.collections.concurrent.concurrentdictionary-2.getenumerator?view=net-6.0
        foreach (var entry in _connections)
        {
            var connection = entry.Value;
            if (predicate(connection))
            {
                connections.Add(connection);
            }
        }

        return connections;
    }
}
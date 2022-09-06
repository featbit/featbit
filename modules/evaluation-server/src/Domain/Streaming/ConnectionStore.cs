using System.Collections.Concurrent;

namespace Domain.Streaming;

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
}
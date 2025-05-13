using System.Collections.Concurrent;
using Microsoft.Extensions.Logging;

namespace Streaming.Connections;

public sealed partial class ConnectionManager(ILogger<ConnectionManager> logger) : IConnectionManager
{
    internal readonly ConcurrentDictionary<string, Connection> Connections = new(StringComparer.Ordinal);

    public Connection Add(WebsocketConnectionContext context)
    {
        var primaryConnection = context.Connection;

        if (context.Type == ConnectionType.RelayProxy)
        {
            foreach (var connection in context.MappedRpConnections)
            {
                Connections.TryAdd(connection.Id, connection);
            }
        }
        else
        {
            Connections.TryAdd(primaryConnection.Id, primaryConnection);
        }

        Log.ConnectionAdded(logger, primaryConnection);

        return primaryConnection;
    }

    public void Remove(WebsocketConnectionContext context)
    {
        var connection = context.Connection;

        if (context.Type == ConnectionType.RelayProxy)
        {
            foreach (var mappedConnection in context.MappedRpConnections)
            {
                mappedConnection.MarkAsClosed();
                Connections.TryRemove(mappedConnection.Id, out _);
            }
        }
        else
        {
            Connections.TryRemove(connection.Id, out _);
        }

        Log.ConnectionRemoved(logger, connection);
    }

    public ICollection<Connection> GetEnvConnections(Guid envId)
    {
        var connections = new List<Connection>();

        // the enumerator returned from the concurrent dictionary is safe to use concurrently with reads and writes to the dictionary
        // see https://learn.microsoft.com/en-us/dotnet/api/system.collections.concurrent.concurrentdictionary-2.getenumerator?view=net-6.0
        foreach (var entry in Connections)
        {
            var connection = entry.Value;
            if (connection.EnvId == envId)
            {
                connections.Add(connection);
            }
        }

        return connections;
    }
}
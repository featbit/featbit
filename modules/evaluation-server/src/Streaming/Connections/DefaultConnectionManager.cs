using System.Collections.Concurrent;
using Domain.Observability;
using Microsoft.Extensions.Logging;

namespace Streaming.Connections;

public sealed partial class DefaultConnectionManager : IConnectionManager
{
    private readonly ILogger<DefaultConnectionManager> _logger;

    internal readonly ConcurrentDictionary<string, Connection> Connections = new(StringComparer.Ordinal);

    public DefaultConnectionManager(ILogger<DefaultConnectionManager> logger)
    {
        _logger = logger;

        // M1: the gauge reads ConcurrentDictionary.Count, which is O(1) and lock-free here. It is
        // deliberately not a scan of the dictionary — a callback that enumerated connections would
        // run on every collection interval and contend with the streaming hot path.
        StreamingMetrics.Current.SetSubscriptionCountProvider(() => Connections.Count);
    }

    public Task Add(ConnectionContext context)
    {
        if (context.Type == ConnectionType.RelayProxy)
        {
            foreach (var connection in context.MappedRpConnections)
            {
                Connections.TryAdd(connection.Id, connection);
            }
        }
        else
        {
            Connections.TryAdd(context.Connection.Id, context.Connection);
        }

        Log.ConnectionAdded(_logger, context);

        return Task.CompletedTask;
    }

    public Task Remove(ConnectionContext context)
    {
        if (context.Type == ConnectionType.RelayProxy)
        {
            foreach (var mappedConnection in context.MappedRpConnections)
            {
                Connections.TryRemove(mappedConnection.Id, out _);
            }
        }
        else
        {
            Connections.TryRemove(context.Connection.Id, out _);
        }

        context.MarkAsClosed();

        Log.ConnectionRemoved(_logger, context);

        return Task.CompletedTask;
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

    public ICollection<Connection> GetAllConnections() => Connections.Values;
}
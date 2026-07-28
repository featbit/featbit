using System.Collections.Concurrent;
using Domain.ControlPlane;
using Domain.Messages;
using Microsoft.Extensions.Logging;

namespace Streaming.Connections;

public sealed partial class ConnectionManager(ILogger<ConnectionManager> logger, IMessageProducer producer)
    : IConnectionManager
{
    internal readonly ConcurrentDictionary<string, Connection> Connections = new(StringComparer.Ordinal);

    public async Task Add(ConnectionContext context)
    {
        if (context.Type == ConnectionType.RelayProxy)
        {
            foreach (var connection in context.MappedRpConnections)
            {
                try
                {
                    var added = Connections.TryAdd(connection.Id, connection);
                    if (added)
                    {
                        await producer.PublishAsync(Topics.ConnectionMade,
                            ConnectionMessage.CreateConnectionMadeMessage(connection.Id, connection.EnvId,
                                connection.Secret.ProjectKey));
                        Log.ConnectionAdded(logger, context);
                    }
                }
                catch (Exception ex)
                {
                    Log.AddConnectionFailed(logger, context, ex);
                }
            }
        }
        else
        {
            try
            {
                var added = Connections.TryAdd(context.Connection.Id, context.Connection);
                if (added)
                {
                    await producer.PublishAsync(Topics.ConnectionMade,
                        ConnectionMessage.CreateConnectionMadeMessage(context.Connection.Id, context.Connection.EnvId,
                            context.Connection.Secret.ProjectKey));
                    Log.ConnectionAdded(logger, context);
                }
            }
            catch (Exception ex)
            {
                Log.AddConnectionFailed(logger, context, ex);
            }
        }
    }

    public async Task Remove(ConnectionContext context)
    {
        bool connectionRemoved = false;

        if (context.Type == ConnectionType.RelayProxy)
        {
            foreach (var mappedConnection in context.MappedRpConnections)
            {
                try
                {
                    connectionRemoved = Connections.TryRemove(mappedConnection.Id, out _);
                    if (!connectionRemoved)
                    {
                        continue;
                    }

                    await producer.PublishAsync(Topics.ConnectionClosed,
                        ConnectionMessage.CreateConnectionClosedMessage(context.Connection.Id,
                            context.Connection.EnvId,
                            mappedConnection.Secret.ProjectKey));
                    Log.ConnectionRemoved(logger, context);
                }
                catch (Exception ex)
                {
                    Log.RemoveConnectionFailed(logger, context, ex);
                }
            }
        }
        else
        {
            try
            {
                connectionRemoved = Connections.TryRemove(context.Connection.Id, out _);
                if (connectionRemoved)
                {
                    await producer.PublishAsync(Topics.ConnectionClosed,
                        ConnectionMessage.CreateConnectionClosedMessage(context.Connection.Id, context.Connection.EnvId,
                            context.Connection.Secret.ProjectKey));
                    Log.ConnectionRemoved(logger, context);
                }
            }
            catch (Exception ex)
            {
                Log.RemoveConnectionFailed(logger, context, ex);
            }
        }

        context.MarkAsClosed();
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

    public ICollection<Connection> GetAllConnections()
    {
        return Connections.Values;
    }
}
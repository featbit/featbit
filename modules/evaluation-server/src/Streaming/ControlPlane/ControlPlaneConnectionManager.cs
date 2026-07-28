using System.Collections.Concurrent;
using Domain.ControlPlane;
using Domain.Messages;
using Microsoft.Extensions.Logging;
using Streaming.Connections;

namespace Streaming.ControlPlane;

public sealed class ControlPlaneConnectionManager(
    ILogger<ControlPlaneConnectionManager> logger,
    IMessageProducer producer) : IConnectionManager
{
    internal readonly ConcurrentDictionary<string, Connection> Connections = new(StringComparer.Ordinal);

    public async Task Add(ConnectionContext context)
    {
        if (context.Type == ConnectionType.RelayProxy)
        {
            var addTasks = context.MappedRpConnections.Select(AddSingleAsync);
            await Task.WhenAll(addTasks);
        }
        else
        {
            await AddSingleAsync(context.Connection);
        }

        return;

        async Task AddSingleAsync(Connection connection)
        {
            try
            {
                var added = Connections.TryAdd(connection.Id, connection);
                if (added)
                {
                    var message = connection.AsMessage(ConnectionMessageType.ConnectionMade);
                    await producer.PublishAsync(Topics.ConnectionMade, message);
                    ConnectionManager.Log.ConnectionAdded(logger, context);
                }
            }
            catch (Exception ex)
            {
                ConnectionManager.Log.AddConnectionFailed(logger, context, ex);
            }
        }
    }

    public async Task Remove(ConnectionContext context)
    {
        if (context.Type == ConnectionType.RelayProxy)
        {
            var removeTasks = context.MappedRpConnections.Select(connection => RemoveSingleAsync(connection, context));
            await Task.WhenAll(removeTasks);
        }
        else
        {
            await RemoveSingleAsync(context.Connection, context);
        }

        context.MarkAsClosed();
        return;

        async Task RemoveSingleAsync(Connection connection, ConnectionContext connectionContext)
        {
            try
            {
                var connectionRemoved = Connections.TryRemove(connection.Id, out _);
                if (connectionRemoved)
                {
                    var message = connection.AsMessage(ConnectionMessageType.ConnectionClosed);
                    await producer.PublishAsync(Topics.ConnectionClosed, message);
                    ConnectionManager.Log.ConnectionRemoved(logger, connectionContext);
                }
            }
            catch (Exception ex)
            {
                ConnectionManager.Log.RemoveConnectionFailed(logger, connectionContext, ex);
            }
        }
    }

    public ICollection<Connection> GetEnvConnections(Guid envId)
    {
        var connections = new List<Connection>();

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
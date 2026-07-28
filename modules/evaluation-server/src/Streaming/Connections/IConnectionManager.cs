namespace Streaming.Connections;

public interface IConnectionManager
{
    /// <summary>
    /// Called when a connection is started.
    /// </summary>
    /// <param name="connection">The websocket connection context.</param>
    Task Add(ConnectionContext connection);

    /// <summary>
    /// Called when a connection is finished.
    /// </summary>
    /// <param name="context">The websocket connection context.</param>
    Task Remove(ConnectionContext context);

    /// <summary>
    /// Get environment connections
    /// </summary>
    /// <returns></returns>
    ICollection<Connection> GetEnvConnections(Guid envId);

    /// <summary>
    /// Get all connections
    /// </summary>
    /// <returns></returns>
    ICollection<Connection> GetAllConnections();
}
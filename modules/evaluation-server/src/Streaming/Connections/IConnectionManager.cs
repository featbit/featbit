namespace Streaming.Connections;

public interface IConnectionManager
{
    /// <summary>
    /// Called when a connection is started.
    /// </summary>
    /// <param name="connection">The websocket connection context.</param>
    void Add(ConnectionContext connection);

    /// <summary>
    /// Called when a connection is finished.
    /// </summary>
    /// <param name="context">The websocket connection context.</param>
    void Remove(ConnectionContext context);

    /// <summary>
    /// Get environment connections
    /// </summary>
    /// <returns></returns>
    ICollection<Connection> GetEnvConnections(Guid envId);
}
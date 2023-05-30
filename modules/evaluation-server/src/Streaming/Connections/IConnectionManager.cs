namespace Streaming.Connections;

public interface IConnectionManager
{
    /// <summary>
    /// Called when a connection is started.
    /// </summary>
    /// <param name="connection">The connection.</param>
    /// <returns>A <see cref="Task"/> that represents the asynchronous connect.</returns>
    void Add(Connection connection);

    /// <summary>
    /// Called when a connection is finished.
    /// </summary>
    /// <param name="connection">The connection.</param>
    /// <returns>A <see cref="Task"/> that represents the asynchronous disconnect.</returns>
    void Remove(Connection connection);

    /// <summary>
    /// Get environment connections
    /// </summary>
    /// <returns></returns>
    ICollection<Connection> GetEnvConnections(Guid envId);
}
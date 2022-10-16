namespace Domain.WebSockets;

public interface IConnectionHandler
{
    /// <summary>
    /// Called when a new connection is accepted.
    /// </summary>
    /// <param name="connection">The new <see cref="Connection"/></param>
    /// <param name="cancellationToken">The cancellationToken</param>
    /// <returns>A <see cref="Task"/> that represents the connection lifetime. When the task completes, the connection is complete.</returns>
    Task OnConnectedAsync(Connection connection, CancellationToken cancellationToken);
}
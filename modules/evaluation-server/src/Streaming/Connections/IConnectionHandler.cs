using Streaming.Messages;

namespace Streaming.Connections;

public interface IConnectionHandler
{
    /// <summary>
    /// Called when a new connection is accepted.
    /// </summary>
    /// <param name="connection">The new <see cref="Connection"/></param>
    /// <param name="cancellationToken">The cancellationToken</param>
    /// <returns>A <see cref="Task"/> that represents the connection lifetime. When the task completes, the connection is complete.</returns>
    Task OnConnectedAsync(Connection connection, CancellationToken cancellationToken);

    /// <summary>
    /// Called when the connection receives a new message
    /// </summary>
    /// <param name="connection">The <see cref="Connection"/></param>
    /// <param name="message">The received message</param>
    /// <param name="cancellationToken">The cancellationToken</param>
    /// <returns>A <see cref="Task"/></returns>
    Task OnMessageAsync(Connection connection, Message message, CancellationToken cancellationToken);

    /// <summary>
    /// Called when an error occurs while receiving a message
    /// </summary>
    /// <param name="connection">The <see cref="Connection"/></param>
    /// <param name="error">The error description</param>
    void OnMessageError(Connection connection, string error);
}
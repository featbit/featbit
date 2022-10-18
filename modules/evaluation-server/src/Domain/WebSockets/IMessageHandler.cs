namespace Domain.WebSockets;

public interface IMessageHandler
{
    Task HandleAsync(Connection connection, Message message, CancellationToken token);
}
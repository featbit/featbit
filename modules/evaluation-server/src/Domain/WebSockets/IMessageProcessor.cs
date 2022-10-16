namespace Domain.WebSockets;

public interface IMessageProcessor
{
    event Func<Connection, Message, CancellationToken, Task>? OnMessageAsync;

    event Action<Connection, string>? OnError;

    Task StartAsync(Connection connection, CancellationToken token);
}
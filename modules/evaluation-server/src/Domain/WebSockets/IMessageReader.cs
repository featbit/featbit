namespace Domain.WebSockets;

public interface IMessageReader
{
    event Func<Connection, Message, CancellationToken, Task>? OnMessageAsync;

    event Action<Connection, string>? OnError;

    Task StartAsync(Connection connection, CancellationToken token);
}
namespace Domain.Messages;

public interface IMessageHandler
{
    public string Topic { get; }

    Task HandleAsync(string message, CancellationToken cancellationToken);
}
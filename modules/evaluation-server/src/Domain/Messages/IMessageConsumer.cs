namespace Domain.Messages;

public interface IMessageConsumer
{
    public string Topic { get; }

    Task HandleAsync(string message, CancellationToken cancellationToken);
}
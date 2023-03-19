namespace Domain.Core;

public interface IMqMessageHandler
{
    public string Topic { get; }

    Task HandleAsync(string message, CancellationToken cancellationToken);
}
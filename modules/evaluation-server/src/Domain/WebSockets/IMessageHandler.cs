namespace Domain.WebSockets;

public interface IMessageHandler
{
    public string Type { get; }

    Task HandleAsync(MessageContext ctx);
}
namespace Domain.MessageHandlers;

public interface IMessageHandler
{
    public string Type { get; }

    Task HandleAsync(MessageContext ctx);
}
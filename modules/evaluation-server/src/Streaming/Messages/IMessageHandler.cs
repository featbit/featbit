namespace Streaming.Messages;

public interface IMessageHandler
{
    public string Type { get; }

    Task HandleAsync(MessageContext ctx);
}
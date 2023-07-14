namespace Domain.Messages;

public class NullMessageProducer : IMessageProducer
{
    public Task PublishAsync<TMessage>(string topic, TMessage? message) where TMessage : class
    {
        return Task.CompletedTask;
    }
}
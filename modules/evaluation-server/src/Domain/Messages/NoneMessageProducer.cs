namespace Domain.Messages;

public class NoneMessageProducer : IMessageProducer
{
    public Task PublishAsync<TMessage>(string topic, TMessage? message) where TMessage : class => Task.CompletedTask;
}
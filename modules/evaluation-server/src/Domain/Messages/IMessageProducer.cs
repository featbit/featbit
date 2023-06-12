namespace Domain.Messages;

public interface IMessageProducer
{
    Task PublishAsync<TMessage>(string topic, TMessage? message) where TMessage : class;
}
namespace Domain.Core;

public interface IMessageProducer
{
    Task PublishAsync<TMessage>(string topic, TMessage? message) where TMessage : class;
}
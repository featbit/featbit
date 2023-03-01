namespace Domain.Core;

public interface IMqMessageProducer
{
    Task PublishAsync<TMessage>(string topic, TMessage? message) where TMessage : class;
}
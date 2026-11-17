namespace Domain.Messages;

public interface IMessageProducer
{
    Task PublishAsync<TMessage>(string topic, TMessage? message) where TMessage : class;

    Task PublishBatchAsync<TMessage>(string topic, IReadOnlyCollection<TMessage> messages) where TMessage : class;
}

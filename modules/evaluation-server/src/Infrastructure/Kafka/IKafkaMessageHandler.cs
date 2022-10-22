using Confluent.Kafka;

namespace Infrastructure.Kafka;

public interface IKafkaMessageHandler
{
    public string Topic { get; }

    Task HandleAsync(ConsumeResult<Null, string> consumeResult);
}
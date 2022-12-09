using Domain.Core;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Kafka;

public partial class FakeKafkaMessageProducer : IMessageProducer
{

    public FakeKafkaMessageProducer(IConfiguration configuration, ILogger<FakeKafkaMessageProducer> logger)
    {
    }

    public Task PublishAsync<TMessage>(string topic, TMessage? message) where TMessage : class
    {
        return Task.CompletedTask;
    }
}
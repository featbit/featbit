using System.Net;
using System.Text.Json;
using Confluent.Kafka;
using Domain.Messages;
using Domain.Shared;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Kafka;

public partial class KafkaMessageProducer : IMessageProducer
{
    private readonly ILogger<KafkaMessageProducer> _logger;
    private readonly IProducer<Null, string> _producer;

    public KafkaMessageProducer(IConfiguration configuration, ILogger<KafkaMessageProducer> logger)
    {
        ProducerConfig config = new()
        {
            BootstrapServers = configuration["Kafka:BootstrapServers"],
            ClientId = Dns.GetHostName()
        };

        _producer = new ProducerBuilder<Null, string>(config).Build();
        _logger = logger;
    }

    public Task PublishAsync<TMessage>(string topic, TMessage? message) where TMessage : class
    {
        if (message == null)
        {
            // ignore null message
            return Task.CompletedTask;
        }

        try
        {
            var value = JsonSerializer.Serialize(message, ReusableJsonSerializerOptions.Web);

            // for high throughput processing, we use Produce method, which is also asynchronous, in that it never blocks.
            // https://docs.confluent.io/kafka-clients/dotnet/current/overview.html#producer
            _producer.Produce(topic, new Message<Null, string>
            {
                Value = value
            }, DeliveryHandler);

            void DeliveryHandler(DeliveryReport<Null, string> report)
            {
                if (report.Error.IsError)
                {
                    Log.ErrorDeliveryMessage(_logger, topic, value, report.Error.ToString());
                }
            }
        }
        catch (ProduceException<Null, string> ex)
        {
            var deliveryResult = ex.DeliveryResult;

            Log.ErrorDeliveryMessage(_logger, deliveryResult.Topic, deliveryResult.Value, ex.Error.ToString());
        }
        catch (Exception ex)
        {
            Log.ErrorPublishMessage(_logger, ex);
        }

        return Task.CompletedTask;
    }
}
using System.Net;
using System.Text.Json;
using Confluent.Kafka;
using Domain.Messages;
using Domain.Utils;
using Microsoft.Extensions.Logging;

namespace Infrastructure.MQ.Kafka;

public partial class KafkaMessageProducer : IMessageProducer
{
    private readonly ILogger<KafkaMessageProducer> _logger;
    private readonly IProducer<Null, string> _producer;

    public KafkaMessageProducer(ProducerConfig config, ILogger<KafkaMessageProducer> logger)
    {
        config.ClientId = Dns.GetHostName();

        _producer = new ProducerBuilder<Null, string>(config).Build();
        _logger = logger;
    }

    internal KafkaMessageProducer(IProducer<Null, string> producer, ILogger<KafkaMessageProducer> logger)
    {
        _producer = producer;
        _logger = logger;
    }

    public async Task PublishAsync<TMessage>(string topic, TMessage? message) where TMessage : class
    {
        if (message == null)
        {
            // ignore null message
            return;
        }

        try
        {
            var value = JsonSerializer.Serialize(message, ReusableJsonSerializerOptions.Web);

            await _producer.ProduceAsync(topic, new Message<Null, string> { Value = value });
        }
        catch (ProduceException<Null, string> ex)
        {
            var deliveryResult = ex.DeliveryResult;

            Log.ErrorDeliveryMessage(_logger, deliveryResult.Topic, deliveryResult.Value, ex.Error.ToString());
            throw;
        }
        catch (Exception ex)
        {
            Log.ErrorPublishMessage(_logger, ex);
            throw;
        }

        return;
    }
}
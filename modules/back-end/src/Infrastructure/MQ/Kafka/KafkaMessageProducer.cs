using System.Diagnostics;
using System.Net;
using System.Text.Json;
using Confluent.Kafka;
using Domain.Messages;
using Domain.Observability;
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

    public Task PublishAsync<TMessage>(string topic, TMessage? message) where TMessage : class
    {
        if (message == null)
        {
            // ignore null message
            return Task.CompletedTask;
        }

        // M2: Produce() is fire-and-forget by design, so this scope can only ever report
        // outcome=enqueued — it measures acceptance into the client's send buffer, not delivery.
        // Asynchronous broker-reported delivery failures are counted separately below, since they
        // arrive long after this scope has closed.
        using var publish = MessagingMetrics.Current.BeginPublish(MessagingSystems.Kafka, topic);

        try
        {
            var value = JsonSerializer.Serialize(message, ReusableJsonSerializerOptions.Web);

            // for high throughput processing, we use Produce method, which is also asynchronous, in that it never blocks.
            // https://docs.confluent.io/kafka-clients/dotnet/current/overview.html#producer
            //
            // Trace context rides on Kafka headers so the consuming service continues this trace
            // instead of starting an unrelated one. Inject returns null when there is nothing to
            // propagate, which leaves the message identical to what an older producer wrote.
            _producer.Produce(topic, new Message<Null, string>
            {
                Value = value,
                Headers = KafkaTraceContext.Inject(Activity.Current)
            }, DeliveryHandler);

            publish.Enqueued();

            void DeliveryHandler(DeliveryReport<Null, string> report)
            {
                if (report.Error.IsError)
                {
                    MessagingMetrics.Current.RecordDeliveryFailure(MessagingSystems.Kafka, topic);
                    Log.ErrorDeliveryMessage(_logger, topic, value, report.Error.ToString());
                }
            }
        }
        catch (ProduceException<Null, string> ex)
        {
            var deliveryResult = ex.DeliveryResult;

            publish.Failed(ex);
            MessagingMetrics.Current.RecordDeliveryFailure(MessagingSystems.Kafka, deliveryResult.Topic);
            Log.ErrorDeliveryMessage(_logger, deliveryResult.Topic, deliveryResult.Value, ex.Error.ToString());
        }
        catch (Exception ex)
        {
            publish.Failed(ex);
            Log.ErrorPublishMessage(_logger, ex);
        }

        return Task.CompletedTask;
    }
}
using Confluent.Kafka;
using Infrastructure.MQ;
using Microsoft.Extensions.DependencyInjection;

namespace Application.IntegrationTests.Configuration;

[Collection(nameof(TestApp))]
public class KafkaConfigTests
{
    private readonly TestApp _app;

    public KafkaConfigTests(TestApp app)
    {
        _app = app;
    }

    [Fact]
    public async Task DefaultProducerConsumerConfig()
    {
        var proServices = _app.WithWebHostBuilder(builder => builder.UseSetting(MqProvider.SectionName, MqProvider.Kafka))
            .Services;

        var producerConfig = proServices.GetRequiredService<ProducerConfig>();
        var consumerConfig = proServices.GetRequiredService<ConsumerConfig>();

        await Verify(new { producerConfig, consumerConfig });
    }
}
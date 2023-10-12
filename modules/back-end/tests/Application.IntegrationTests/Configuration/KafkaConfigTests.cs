using Confluent.Kafka;
using Microsoft.Extensions.DependencyInjection;

namespace Application.IntegrationTests.Configuration;

[Collection(nameof(TestApp))]
[UsesVerify]
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
        var proServices = _app.WithWebHostBuilder(builder => builder.UseSetting("IS_PRO", "true")).Services;

        var producerConfig = proServices.GetRequiredService<ProducerConfig>();
        var consumerConfig = proServices.GetRequiredService<ConsumerConfig>();

        await Verify(new { producerConfig, consumerConfig });
    }
}
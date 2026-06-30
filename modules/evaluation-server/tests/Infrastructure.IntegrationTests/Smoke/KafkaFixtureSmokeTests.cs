using Confluent.Kafka;
using Infrastructure.IntegrationTests.Fixtures;

namespace Infrastructure.IntegrationTests.Smoke;

[Collection(KafkaCollection.Name)]
public class KafkaFixtureSmokeTests : IntegrationTestBase
{
    private readonly KafkaFixture _fixture;

    public KafkaFixtureSmokeTests(KafkaFixture fixture)
    {
        _fixture = fixture;
    }

    [DockerFact]
    public void Fixture_ReportsClusterMetadata()
    {
        var config = new AdminClientConfig { BootstrapServers = _fixture.BootstrapServers };
        using var admin = new AdminClientBuilder(config).Build();

        var metadata = admin.GetMetadata(TimeSpan.FromSeconds(15));

        Assert.NotEmpty(metadata.Brokers);
    }
}

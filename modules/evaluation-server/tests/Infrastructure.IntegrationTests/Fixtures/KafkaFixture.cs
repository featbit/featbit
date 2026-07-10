using Testcontainers.Kafka;

namespace Infrastructure.IntegrationTests.Fixtures;

/// <summary>
/// Spins up a single Kafka container, shared across the <c>Kafka</c> xUnit collection.
/// </summary>
public sealed class KafkaFixture : IAsyncLifetime
{
    private readonly KafkaContainer _container = new KafkaBuilder()
        .WithImage("confluentinc/cp-kafka:7.6.1")
        .Build();

    public string BootstrapServers => _container.GetBootstrapAddress();

    public async Task InitializeAsync()
    {
        if (!DockerAvailability.IsAvailable)
        {
            return;
        }

        await _container.StartAsync();
    }

    public async Task DisposeAsync()
    {
        if (!DockerAvailability.IsAvailable)
        {
            return;
        }

        await _container.DisposeAsync();
    }
}

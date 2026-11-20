using Testcontainers.MongoDb;

namespace Infrastructure.IntegrationTests.Fixtures;

/// <summary>
/// Spins up a single MongoDB container, shared across the <c>Mongo</c> xUnit collection.
/// </summary>
public sealed class MongoDbFixture : IAsyncLifetime
{
    private readonly MongoDbContainer _container = new MongoDbBuilder()
        .WithImage("mongo:7.0")
        .Build();

    public string ConnectionString => _container.GetConnectionString();

    public async ValueTask InitializeAsync()
    {
        if (!DockerAvailability.IsAvailable)
        {
            return;
        }

        await _container.StartAsync();
    }

    public async ValueTask DisposeAsync()
    {
        if (!DockerAvailability.IsAvailable)
        {
            return;
        }

        await _container.DisposeAsync();
    }
}

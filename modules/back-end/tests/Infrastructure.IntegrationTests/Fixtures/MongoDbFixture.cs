using Testcontainers.MongoDb;
using DotNet.Testcontainers.Containers;

namespace Infrastructure.IntegrationTests.Fixtures;

/// <summary>
/// Spins up a single MongoDB container, shared across the <c>Mongo</c> xUnit collection.
/// </summary>
public sealed class MongoDbFixture : IAsyncLifetime
{
    private readonly MongoDbContainer _container = new MongoDbBuilder("mongo:7.0").Build();

    public string ConnectionString => _container.GetConnectionString();

    public Task<ExecResult> ExecuteScriptAsync(string script) => _container.ExecScriptAsync(script);

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
